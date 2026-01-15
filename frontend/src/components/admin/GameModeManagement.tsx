import React, { useState, useEffect } from "react";
import {
  getAllGameModes,
  deleteGameMode,
  updateGameMode,
  createGameMode,
  type GameModeDto,
  type CreateUpdateGameModeRequest,
} from "../../api/admin";
import {
  FiSettings,
  FiTrash2,
  FiEdit2,
  FiCheck,
  FiX,
  FiPlus,
  FiAlertCircle,
} from "react-icons/fi";
import "./GameModeManagement.css";

interface EditingMode {
  id: number;
  data: CreateUpdateGameModeRequest;
}

const GameModeManagement: React.FC = () => {
  const [modes, setModes] = useState<GameModeDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingMode, setEditingMode] = useState<EditingMode | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newMode, setNewMode] = useState<CreateUpdateGameModeRequest>({
    name: "",
    displayName: "",
    description: "",
    minTimeMinutes: 1,
    maxTimeMinutes: 60,
    incrementSeconds: 0,
    icon: "🎮",
  });

  useEffect(() => {
    loadModes();
  }, []);

  const loadModes = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAllGameModes();
      setModes(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load game modes");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (modeId: number) => {
    if (!window.confirm("Are you sure you want to delete this game mode?")) return;

    try {
      await deleteGameMode(modeId);
      setModes(modes.filter((m) => m.id !== modeId));
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete game mode");
    }
  };

  const handleEdit = (mode: GameModeDto) => {
    setEditingMode({
      id: mode.id,
      data: {
        name: mode.name,
        displayName: mode.displayName,
        description: mode.description || "",
        minTimeMinutes: mode.minTimeMinutes,
        maxTimeMinutes: mode.maxTimeMinutes,
        incrementSeconds: mode.incrementSeconds,
        icon: mode.icon || "🎮",
      },
    });
  };

  const handleSaveEdit = async () => {
    if (!editingMode) return;

    try {
      const response = await updateGameMode(editingMode.id, editingMode.data);
      setModes(modes.map((m) => (m.id === editingMode.id ? response.data : m)));
      setEditingMode(null);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update game mode");
    }
  };

  const handleCreateMode = async () => {
    if (!newMode.name.trim()) {
      setError("Mode name is required");
      return;
    }
    if (!newMode.displayName.trim()) {
      setError("Display name is required");
      return;
    }

    try {
      const response = await createGameMode(newMode);
      setModes([...modes, response.data]);
      setNewMode({
        name: "",
        displayName: "",
        description: "",
        minTimeMinutes: 1,
        maxTimeMinutes: 60,
        incrementSeconds: 0,
        icon: "🎮",
      });
      setShowCreateForm(false);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create game mode");
    }
  };

  const filteredModes = modes.filter(
    (mode) =>
      mode.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mode.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="loading">Loading game modes...</div>;
  }

  return (
    <div className="game-mode-management">
      <div className="management-header">
        <h2>
          <FiSettings /> Game Mode Management
        </h2>
        <div className="header-controls">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn-create"
          >
            <FiPlus /> New Mode
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <FiAlertCircle /> {error}
        </div>
      )}

      {showCreateForm && (
        <div className="create-form">
          <h3>Create New Game Mode</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Name (Internal)</label>
              <input
                type="text"
                value={newMode.name}
                onChange={(e) => setNewMode({ ...newMode, name: e.target.value })}
                placeholder="e.g., ULTRA_BULLET"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Display Name</label>
              <input
                type="text"
                value={newMode.displayName}
                onChange={(e) =>
                  setNewMode({ ...newMode, displayName: e.target.value })
                }
                placeholder="e.g., Ultra Bullet"
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Icon</label>
              <input
                type="text"
                value={newMode.icon}
                onChange={(e) => setNewMode({ ...newMode, icon: e.target.value })}
                placeholder="e.g., ⚡"
                maxLength={2}
                className="form-input icon-input"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Min Time (minutes)</label>
              <input
                type="number"
                min="1"
                value={newMode.minTimeMinutes}
                onChange={(e) =>
                  setNewMode({
                    ...newMode,
                    minTimeMinutes: parseInt(e.target.value),
                  })
                }
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Max Time (minutes)</label>
              <input
                type="number"
                min="1"
                value={newMode.maxTimeMinutes}
                onChange={(e) =>
                  setNewMode({
                    ...newMode,
                    maxTimeMinutes: parseInt(e.target.value),
                  })
                }
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label>Increment (seconds)</label>
              <input
                type="number"
                min="0"
                value={newMode.incrementSeconds}
                onChange={(e) =>
                  setNewMode({
                    ...newMode,
                    incrementSeconds: parseInt(e.target.value),
                  })
                }
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group full-width">
            <label>Description</label>
            <textarea
              value={newMode.description}
              onChange={(e) =>
                setNewMode({ ...newMode, description: e.target.value })
              }
              placeholder="Brief description of this game mode"
              className="form-textarea"
              rows={3}
            />
          </div>

          <div className="form-actions">
            <button onClick={handleCreateMode} className="btn-save">
              Create Mode
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="btn-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="modes-grid">
        {filteredModes.length === 0 ? (
          <div className="no-data">No game modes found</div>
        ) : (
          filteredModes.map((mode) => (
            <div
              key={mode.id}
              className={`mode-card ${editingMode?.id === mode.id ? "editing" : ""}`}
            >
              <div className="card-header">
                <span className="icon">{mode.icon}</span>
                <div className="title-info">
                  <h3>{mode.displayName}</h3>
                  <p className="internal-name">{mode.name}</p>
                </div>
              </div>

              <div className="card-content">
                {editingMode?.id === mode.id ? (
                  <>
                    <div className="form-group">
                      <label>Display Name</label>
                      <input
                        type="text"
                        value={editingMode.data.displayName}
                        onChange={(e) =>
                          setEditingMode({
                            ...editingMode,
                            data: {
                              ...editingMode.data,
                              displayName: e.target.value,
                            },
                          })
                        }
                        className="form-input"
                      />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Min Time</label>
                        <input
                          type="number"
                          value={editingMode.data.minTimeMinutes}
                          onChange={(e) =>
                            setEditingMode({
                              ...editingMode,
                              data: {
                                ...editingMode.data,
                                minTimeMinutes: parseInt(e.target.value),
                              },
                            })
                          }
                          className="form-input"
                        />
                      </div>
                      <div className="form-group">
                        <label>Max Time</label>
                        <input
                          type="number"
                          value={editingMode.data.maxTimeMinutes}
                          onChange={(e) =>
                            setEditingMode({
                              ...editingMode,
                              data: {
                                ...editingMode.data,
                                maxTimeMinutes: parseInt(e.target.value),
                              },
                            })
                          }
                          className="form-input"
                        />
                      </div>
                      <div className="form-group">
                        <label>Increment</label>
                        <input
                          type="number"
                          value={editingMode.data.incrementSeconds}
                          onChange={(e) =>
                            setEditingMode({
                              ...editingMode,
                              data: {
                                ...editingMode.data,
                                incrementSeconds: parseInt(e.target.value),
                              },
                            })
                          }
                          className="form-input"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="info-row">
                      <label>Time Control:</label>
                      <span>
                        {mode.minTimeMinutes}-{mode.maxTimeMinutes} min
                        {mode.incrementSeconds > 0 && ` +${mode.incrementSeconds}s`}
                      </span>
                    </div>
                    <div className="info-row">
                      <label>Description:</label>
                      <p>{mode.description || "No description"}</p>
                    </div>
                    <div className="info-row">
                      <label>Created:</label>
                      <span>{mode.createdAt}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="card-actions">
                {editingMode?.id === mode.id ? (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      className="btn-save"
                      title="Save changes"
                    >
                      <FiCheck />
                    </button>
                    <button
                      onClick={() => setEditingMode(null)}
                      className="btn-cancel"
                      title="Cancel editing"
                    >
                      <FiX />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleEdit(mode)}
                      className="btn-edit"
                      title="Edit mode"
                    >
                      <FiEdit2 />
                    </button>
                    <button
                      onClick={() => handleDelete(mode.id)}
                      className="btn-delete"
                      title="Delete mode"
                    >
                      <FiTrash2 />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default GameModeManagement;
