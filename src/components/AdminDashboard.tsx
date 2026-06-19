import {
  getKnowledgeDocuments,
  getKnowledgeSummary,
  resetActiveKnowledgeSources,
  setKnowledgeSourceActive,
} from "../services/knowledgeAdminService";

interface AdminDashboardProps {
  onBackToChat: () => void;
  onLogout: () => void;
  onRefresh: () => void;
}

function AdminDashboard({
  onBackToChat,
  onLogout,
  onRefresh,
}: AdminDashboardProps) {
  const documents = getKnowledgeDocuments();
  const summary = getKnowledgeSummary();

  const handleToggleDocument = (source: string, isActive: boolean) => {
    setKnowledgeSourceActive(source, isActive);
    onRefresh();
  };

  const handleReset = () => {
    resetActiveKnowledgeSources();
    onRefresh();
  };

  return (
    <div className="admin-page admin-dashboard-page">
      <section className="admin-dashboard" aria-labelledby="admin-title">
        <header className="admin-dashboard-header">
          <div>
            <span className="admin-eyebrow">Dashboard Admin</span>
            <h1 id="admin-title">Knowledge Base</h1>
            <p>Daftar dokumen yang diunggah dan aktif digunakan chatbot.</p>
          </div>

          <div className="admin-toolbar">
            <button
              className="admin-secondary-btn"
              onClick={onBackToChat}
              type="button"
            >
              Chatbot
            </button>
            <button
              className="admin-secondary-btn"
              onClick={handleReset}
              type="button"
            >
              Aktifkan Semua
            </button>
            <button className="admin-danger-btn" onClick={onLogout} type="button">
              Keluar
            </button>
          </div>
        </header>

        <div className="admin-summary-grid" aria-label="Ringkasan knowledge base">
          <div className="admin-summary-item">
            <span>Dokumen Diunggah</span>
            <strong>{summary.totalDocuments}</strong>
          </div>
          <div className="admin-summary-item">
            <span>Dokumen Aktif</span>
            <strong>{summary.activeDocuments}</strong>
          </div>
        </div>

        <div className="document-table" role="table" aria-label="Dokumen knowledge base">
          <div className="document-table-header" role="row">
            <span role="columnheader">Dokumen</span>
            <span role="columnheader">Bagian</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Aksi</span>
          </div>

          {documents.map((document) => (
            <article className="document-row" key={document.source} role="row">
              <div className="document-main" role="cell">
                <strong>{document.source}</strong>
                <span>{document.title}</span>
              </div>

              <div className="document-sections" role="cell">
                <span>{document.sections.length} bagian</span>
              </div>

              <div role="cell">
                <span
                  className={
                    document.isActive
                      ? "document-status active"
                      : "document-status inactive"
                  }
                >
                  {document.isActive ? "Aktif" : "Nonaktif"}
                </span>
              </div>

              <div className="document-actions" role="cell">
                <label className="admin-switch">
                  <input
                    checked={document.isActive}
                    onChange={(event) =>
                      handleToggleDocument(document.source, event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>{document.isActive ? "Dipakai" : "Tidak Dipakai"}</span>
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AdminDashboard;

