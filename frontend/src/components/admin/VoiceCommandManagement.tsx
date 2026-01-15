import React, { useState, useEffect } from "react";
import {
  getAllVoiceCommands,
  deleteVoiceCommand,
  toggleVoiceCommandStatus,
  updateVoiceCommand,
  createVoiceCommand,
  type VoiceCommandDto,
  type CreateUpdateVoiceCommandRequest,
} from "../../api/admin";
import {
  FiMic,
  FiTrash2,
  FiEdit2,
  FiCheck,
  FiX,
  FiPlus,
  FiAlertCircle,
} from "react-icons/fi";
import "./VoiceCommandManagement.css";

interface EditingCommand {
  id: number;
  data: CreateUpdateVoiceCommandRequest;
}

const VoiceCommandManagement: React.FC = () => {
  const [commands, setCommands] = useState<VoiceCommandDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCommand, setEditingCommand] = useState<EditingCommand | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCommand, setNewCommand] = useState<CreateUpdateVoiceCommandRequest>({
    commandName: "",
    patterns: [],
    intent: "PIECE",
    description: "",
    active: true,
  });
  const [newPatternInput, setNewPatternInput] = useState("");

  useEffect(() => {
    loadCommands();
  }, []);

  const loadCommands = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAllVoiceCommands();
      setCommands(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load voice commands");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (commandId: number) => {
    if (!window.confirm("Are you sure you want to delete this voice command?")) return;

    try {
      await deleteVoiceCommand(commandId);
      setCommands(commands.filter((c) => c.id !== commandId));
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete command");
    }
  };

  const handleToggleStatus = async (commandId: number) => {
    try {
      const response = await toggleVoiceCommandStatus(commandId);
      setCommands(commands.map((c) => (c.id === commandId ? response.data : c)));
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update command status");
    }
  };

  const handleEdit = (command: VoiceCommandDto) => {
    setEditingCommand({
      id: command.id,
      data: {
        commandName: command.commandName,
        patterns: command.patterns,
        intent: command.intent,
        description: command.description,
        active: command.active,
      },
    });
  };

  const handleSaveEdit = async () => {
    if (!editingCommand) return;

    try {
      const response = await updateVoiceCommand(editingCommand.id, editingCommand.data);
      setCommands(commands.map((c) => (c.id === editingCommand.id ? response.data : c)));
      setEditingCommand(null);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update command");
    }
  };

  const handleCreateCommand = async () => {
    if (!newCommand.commandName.trim()) {
      setError("Command name is required");
      return;
    }
    if (newCommand.patterns.length === 0) {
      setError("At least one pattern is required");
      return;
    }

    try {
      const response = await createVoiceCommand(newCommand);
      setCommands([...commands, response.data]);
      setNewCommand({
        commandName: "",
        patterns: [],
        intent: "PIECE",
        description: "",
        active: true,
      });
      setShowCreateForm(false);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create command");
    }
  };

  const addPattern = () => {
    if (newPatternInput.trim()) {
      setNewCommand({
        ...newCommand,
        patterns: [...newCommand.patterns, newPatternInput.trim()],
      });
      setNewPatternInput("");
    }
  };

  const removePattern = (index: number) => {
    setNewCommand({
      ...newCommand,
      patterns: newCommand.patterns.filter((_, i) => i !== index),
    });
  };

  const filteredCommands = commands.filter(
    (cmd) =>
      cmd.commandName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cmd.intent.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="loading">Loading voice commands...</div>;
  }

  return (
    <div className="voice-command-management">
      <div className="management-header">
        <h2>
          <FiMic /> Voice Command Management
        </h2>
        <div className="header-controls">
          <input
            type="text"
            placeholder="Search by name or intent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="btn-create"
          >
            <FiPlus /> New Command
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
          <h3>Create New Voice Command</h3>
          <div className="form-group">
            <label>Command Name</label>
            <input
              type="text"
              value={newCommand.commandName}
              onChange={(e) =>
                setNewCommand({ ...newCommand, commandName: e.target.value })
              }
              placeholder="e.g., knight, queen, castling"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Intent</label>
            <select
              value={newCommand.intent}
              onChange={(e) => setNewCommand({ ...newCommand, intent: e.target.value })}
              className="form-select"
            >
              <option value="PIECE">Piece</option>
              <option value="ACTION">Action</option>
              <option value="DIRECTION">Direction</option>
              <option value="TIME_CONTROL">Time Control</option>
              <option value="GAME_CONTROL">Game Control</option>
              <option value="OPPONENT_TYPE">Opponent Type</option>
            </select>
          </div>

          <div className="form-group">
            <label>Patterns</label>
            <div className="pattern-input-group">
              <input
                type="text"
                value={newPatternInput}
                onChange={(e) => setNewPatternInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && addPattern()}
                placeholder="Type pattern and press Enter"
                className="form-input"
              />
              <button onClick={addPattern} className="btn-add-pattern">
                Add
              </button>
            </div>
            <div className="patterns-list">
              {newCommand.patterns.map((pattern, index) => (
                <span key={index} className="pattern-badge">
                  {pattern}
                  <button onClick={() => removePattern(index)}>×</button>
                </span>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              value={newCommand.description}
              onChange={(e) =>
                setNewCommand({ ...newCommand, description: e.target.value })
              }
              placeholder="Brief description"
              className="form-input"
            />
          </div>

          <div className="form-actions">
            <button onClick={handleCreateCommand} className="btn-save">
              Create Command
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

      <div className="commands-grid">
        {filteredCommands.length === 0 ? (
          <div className="no-data">No voice commands found</div>
        ) : (
          filteredCommands.map((command) => (
            <div
              key={command.id}
              className={`command-card ${editingCommand?.id === command.id ? "editing" : ""}`}
            >
              <div className="card-header">
                <h3>{command.commandName}</h3>
                <span className={`status ${command.active ? "active" : "inactive"}`}>
                  {command.active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="card-content">
                <div className="info-row">
                  <label>Intent:</label>
                  <span className="intent-badge">{command.intent}</span>
                </div>
                <div className="info-row">
                  <label>Description:</label>
                  <p>{command.description || "No description"}</p>
                </div>
                <div className="patterns-row">
                  <label>Patterns:</label>
                  <div className="patterns-list">
                    {command.patterns.map((pattern, index) => (
                      <span key={index} className="pattern-badge">
                        {pattern}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card-actions">
                <button
                  onClick={() => handleEdit(command)}
                  className="btn-edit"
                  title="Edit command"
                >
                  <FiEdit2 />
                </button>
                <button
                  onClick={() => handleToggleStatus(command.id)}
                  className={`btn-toggle ${command.active ? "active" : ""}`}
                  title={`${command.active ? "Disable" : "Enable"} command`}
                >
                  {command.active ? <FiCheck /> : <FiX />}
                </button>
                <button
                  onClick={() => handleDelete(command.id)}
                  className="btn-delete"
                  title="Delete command"
                >
                  <FiTrash2 />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VoiceCommandManagement;
