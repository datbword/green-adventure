import { useState, useEffect } from "react";
import { listJobs, createJob, addPartToJob } from "~/utils/jobs";
import type { Job, SavedPart } from "~/utils/jobs";

interface SaveToJobModalProps {
  userId: string;
  part: SavedPart;
  onClose: () => void;
  onSaved: () => void;
}

export function SaveToJobModal({ userId, part, onClose, onSaved }: SaveToJobModalProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    listJobs({ data: { userId } }).then((r) => {
      if (r.ok) setJobs(r.jobs!);
      setLoading(false);
    });
  }, [userId]);

  const handleSave = async (jobId: string) => {
    setSaving(jobId);
    const r = await addPartToJob({ data: { userId, jobId, part } });
    if (r.ok) {
      onSaved();
      onClose();
    }
    setSaving(null);
  };

  const handleCreateAndSave = async () => {
    if (!newName.trim()) return;
    const r = await createJob({ data: { userId, name: newName.trim(), notes: "" } });
    if (r.ok && r.job) {
      await handleSave(r.job.id);
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 100,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: "16px",
  };

  const modalStyle = {
    backgroundColor: "var(--bg-secondary)",
    borderRadius: "12px", padding: "24px", width: "100%", maxWidth: "400px",
    border: "1px solid var(--border-color)",
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>Save to Job</h3>
          <button onClick={onClose} className="text-xl leading-none" style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "24px", padding: "4px 8px" }}>
            &times;
          </button>
        </div>

        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          Saving: <span style={{ color: "var(--accent)", fontWeight: 600 }}>{part.partNumber}</span>
        </p>

        {loading ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading jobs...</p>
        ) : (
          <div className="space-y-2 mb-4">
            {jobs.length === 0 && !showCreate && (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No jobs yet. Create one below.</p>
            )}
            {jobs.map((job) => (
              <button key={job.id} onClick={() => handleSave(job.id)}
                className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm transition-colors"
                style={{
                  backgroundColor: saving === job.id ? "var(--bg-tertiary)" : "var(--bg-primary)",
                  border: "1px solid var(--border-color)",
                  cursor: saving === job.id ? "wait" : "pointer",
                  minHeight: "44px",
                }}>
                <span style={{ color: "var(--text-primary)" }}>{job.name}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{job.parts.length} parts</span>
              </button>
            ))}
          </div>
        )}

        {showCreate ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="New job name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm"
              style={{
                backgroundColor: "var(--bg-primary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-color)",
                outline: "none",
                minHeight: "44px",
              }}
            />
            <button onClick={handleCreateAndSave}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-white"
              style={{ backgroundColor: "var(--accent)", border: "none", cursor: "pointer", minHeight: "44px" }}>
              Create
            </button>
          </div>
        ) : (
          <button onClick={() => setShowCreate(true)}
            className="w-full rounded-lg py-2.5 text-sm font-medium"
            style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)", border: "none", cursor: "pointer", minHeight: "44px" }}>
            + New Job
          </button>
        )}
      </div>
    </div>
  );
}