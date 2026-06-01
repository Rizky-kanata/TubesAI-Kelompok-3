$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.IO.Compression.FileSystem

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$outputPath = Join-Path $repoRoot "src\data\knowledgeBase.ts"

$documents = @(
  @{
    Id = "contoh-pertanyaan"
    Title = "Contoh Pertanyaan"
    Type = "docx"
    Path = "C:\Users\night\Downloads\contoh pertanyaan.docx"
  },
  @{
    Id = "final-project"
    Title = "Final Project"
    Type = "pptx"
    Path = "C:\Users\night\Downloads\final project (2).pptx"
  },
  @{
    Id = "alur-lpj"
    Title = "Alur Pengajuan LPJ Kegiatan"
    Type = "docx"
    Path = "D:\Dokumen_RAG_Pendanaan_Ormawa_UKM\Alur Pengajuan LPJ Kegiatan.docx"
  },
  @{
    Id = "alur-proposal"
    Title = "Alur Pengajuan Proposal Dana Kegiatan"
    Type = "docx"
    Path = "D:\Dokumen_RAG_Pendanaan_Ormawa_UKM\Alur Pengajuan Proposal Dana Kegiatan.docx"
  },
  @{
    Id = "alur-sertifikasi"
    Title = "Alur Pengajuan Sertifikasi Kegiatan Ormawa UKM"
    Type = "docx"
    Path = "D:\Dokumen_RAG_Pendanaan_Ormawa_UKM\Alur Pengajuan Sertifikasi Kegiatan Ormawa UKM.docx"
  },
  @{
    Id = "syarat-lpj"
    Title = "Syarat Pengajuan LPJ Kegiatan"
    Type = "docx"
    Path = "D:\Dokumen_RAG_Pendanaan_Ormawa_UKM\Syarat Pengajuan LPJ Kegiatan.docx"
  },
  @{
    Id = "syarat-proposal"
    Title = "Syarat Pengajuan Proposal Dana Kegiatan"
    Type = "docx"
    Path = "D:\Dokumen_RAG_Pendanaan_Ormawa_UKM\Syarat Pengajuan Proposal Dana Kegiatan.docx"
  }
)

function Read-ZipEntryText {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$EntryName
  )

  $archive = [System.IO.Compression.ZipFile]::OpenRead($Path)

  try {
    $entry = $archive.GetEntry($EntryName)

    if ($null -eq $entry) {
      throw "Entry not found in ${Path}: ${EntryName}"
    }

    $stream = $entry.Open()
    $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8)

    try {
      return $reader.ReadToEnd()
    } finally {
      $reader.Dispose()
      $stream.Dispose()
    }
  } finally {
    $archive.Dispose()
  }
}

function Normalize-ExtractedText {
  param([Parameter(Mandatory = $true)][string]$Text)

  return ($Text `
    -replace "`r", "" `
    -replace "[`t ]+", " " `
    -replace " *`n *", "`n" `
    -replace "`n{3,}", "`n`n").Trim()
}

function Read-DocxText {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Id
  )

  $raw = Read-ZipEntryText -Path $Path -EntryName "word/document.xml"
  $builder = [System.Text.StringBuilder]::new()
  $pattern = "(?s)<w:t[^>]*>(.*?)</w:t>|</w:p>|<w:tab[^>]*/>|<w:br[^>]*/>"

  foreach ($match in [regex]::Matches($raw, $pattern)) {
    if ($match.Groups[1].Success) {
      [void]$builder.Append([System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value))
      continue
    }

    if ($match.Value -like "<w:tab*") {
      [void]$builder.Append(" ")
    } else {
      [void]$builder.AppendLine()
    }
  }

  return Normalize-ExtractedText -Text $builder.ToString()
}

function Read-PptxSlides {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Id
  )

  $archive = [System.IO.Compression.ZipFile]::OpenRead($Path)
  $slides = $archive.Entries |
    Where-Object { $_.FullName -match "^ppt/slides/slide[0-9]+\.xml$" } |
    Sort-Object { [int]($_.Name -replace "\D", "") }

  $result = @()

  try {
    foreach ($slide in $slides) {
      $stream = $slide.Open()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8)

      try {
        $raw = $reader.ReadToEnd()
      } finally {
        $reader.Dispose()
        $stream.Dispose()
      }

      $builder = [System.Text.StringBuilder]::new()
      $pattern = "(?s)<a:t[^>]*>(.*?)</a:t>|</a:p>|<a:br[^>]*/>"

      foreach ($match in [regex]::Matches($raw, $pattern)) {
        if ($match.Groups[1].Success) {
          [void]$builder.Append([System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value))
        } else {
          [void]$builder.AppendLine()
        }
      }

      $text = Normalize-ExtractedText -Text $builder.ToString()
      if ($text) {
        $slideNumber = [int]($slide.Name -replace "\D", "")
        $result += @{
          Section = "Slide $slideNumber"
          Content = $text
        }
      }
    }
  } finally {
    $archive.Dispose()
  }

  return $result
}

function Split-DocxSections {
  param(
    [Parameter(Mandatory = $true)][string]$Text,
    [Parameter(Mandatory = $true)][string]$FallbackSection
  )

  $paragraphs = $Text -split "`n+" | Where-Object { $_.Trim().Length -gt 0 }
  $chunks = @()
  $buffer = [System.Collections.Generic.List[string]]::new()
  $section = $FallbackSection

  foreach ($paragraph in $paragraphs) {
    $trimmed = $paragraph.Trim()
    $looksLikeHeading = $trimmed.Length -le 90 -and (
      $trimmed -match "^(alur|syarat|dokumen|tahapan|catatan|contoh|pertanyaan|jawaban|proposal|lpj|sertifikasi)\b" -or
      $trimmed -match "^[0-9]+[.)]\s+\S+"
    )

    if ($looksLikeHeading -and $buffer.Count -ge 2) {
      $chunks += @{
        Section = $section
        Content = ($buffer -join "`n")
      }
      $buffer.Clear()
      $section = $trimmed
      continue
    }

    if ($looksLikeHeading -and $buffer.Count -eq 0) {
      $section = $trimmed
    }

    $buffer.Add($trimmed)

    if (($buffer -join " ").Length -gt 1000) {
      $chunks += @{
        Section = $section
        Content = ($buffer -join "`n")
      }
      $buffer.Clear()
    }
  }

  if ($buffer.Count -gt 0) {
    $chunks += @{
      Section = $section
      Content = ($buffer -join "`n")
    }
  }

  return $chunks
}

function ConvertTo-TsString {
  param([AllowNull()][string]$Value)

  return ($Value | ConvertTo-Json -Compress)
}

$knowledgeChunks = @()

foreach ($document in $documents) {
  if (-not (Test-Path -LiteralPath $document.Path)) {
    throw "Document not found: $($document.Path)"
  }

  if ($document.Type -eq "pptx") {
    $sections = Read-PptxSlides -Path $document.Path -Id $document.Id
  } else {
    $text = Read-DocxText -Path $document.Path -Id $document.Id
    $sections = Split-DocxSections -Text $text -FallbackSection $document.Title
  }

  $index = 1

  foreach ($section in $sections) {
    $content = Normalize-ExtractedText -Text $section.Content

    if (-not $content) {
      continue
    }

    $knowledgeChunks += @{
      Id = "$($document.Id)-$index"
      Title = $document.Title
      Section = $section.Section
      Source = [System.IO.Path]::GetFileName($document.Path)
      Content = $content
    }

    $index += 1
  }
}

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("export interface KnowledgeChunk {")
$lines.Add("  id: string;")
$lines.Add("  title: string;")
$lines.Add("  section: string;")
$lines.Add("  source: string;")
$lines.Add("  content: string;")
$lines.Add("}")
$lines.Add("")
$lines.Add("export const knowledgeChunks: KnowledgeChunk[] = [")

foreach ($chunk in $knowledgeChunks) {
  $lines.Add("  {")
  $lines.Add("    id: $(ConvertTo-TsString $chunk.Id),")
  $lines.Add("    title: $(ConvertTo-TsString $chunk.Title),")
  $lines.Add("    section: $(ConvertTo-TsString $chunk.Section),")
  $lines.Add("    source: $(ConvertTo-TsString $chunk.Source),")
  $lines.Add("    content: $(ConvertTo-TsString $chunk.Content),")
  $lines.Add("  },")
}

$lines.Add("];")
$lines.Add("")
$lines.Add("export const knowledgeSourceCount = $($documents.Count);")
$lines.Add("export const knowledgeChunkCount = $($knowledgeChunks.Count);")
$lines.Add("")

New-Item -ItemType Directory -Path (Split-Path $outputPath) -Force | Out-Null
Set-Content -LiteralPath $outputPath -Encoding UTF8 -Value ($lines -join "`n")

Write-Host "Generated $outputPath with $($knowledgeChunks.Count) chunks from $($documents.Count) documents."

$oldTempRoot = Join-Path $PSScriptRoot ".extract-tmp"
if (Test-Path -LiteralPath $oldTempRoot) {
  try {
    Get-ChildItem -LiteralPath $oldTempRoot -Recurse -Force | ForEach-Object {
      $_.Attributes = [System.IO.FileAttributes]::Normal
    }
    Remove-Item -LiteralPath $oldTempRoot -Recurse -Force -ErrorAction Stop
  } catch {
    Write-Warning "Could not remove old extraction folder. It is safe to delete manually: $oldTempRoot"
  }
}
