import React, { useState, useEffect } from "react";
import { updateProfile, type UserInfo } from "../../api/profile";
import "./EditProfileModal.css";

interface EditProfileModalProps {
  isOpen: boolean;
  userInfo: UserInfo | null;
  onClose: () => void;
  onUpdate: (updatedInfo: UserInfo) => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  userInfo,
  onClose,
  onUpdate,
}) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (userInfo) {
      setName(userInfo.name);
      setPhone(userInfo.phone || "");
      setError("");
      setSuccess("");
    }
  }, [userInfo, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (!name.trim()) {
        setError("Name cannot be empty");
        setLoading(false);
        return;
      }

      const { data } = await updateProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
      });

      setSuccess("Profile updated successfully!");
      setTimeout(() => {
        onUpdate(data);
        onClose();
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update profile"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Profile</h2>
          <button
            className="modal-close"
            onClick={onClose}
            disabled={loading}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-form">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              disabled={loading}
              maxLength={120}
              className="form-input"
            />
            <span className="char-count">{name.length}/120</span>
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your phone number (optional)"
              disabled={loading}
              maxLength={30}
              className="form-input"
            />
            <span className="char-count">{phone.length}/30</span>
          </div>

          <div className="form-group">
            <label>Email (Read-only)</label>
            <input
              type="email"
              value={userInfo?.email || ""}
              disabled
              className="form-input disabled"
            />
            <p className="help-text">
              Email cannot be changed. Contact support if you need to change it.
            </p>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-save"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;
