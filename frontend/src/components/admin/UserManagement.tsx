import React, { useState, useEffect } from "react";
import {
  getAllUsers,
  deleteUser,
  toggleUserStatus,
  updateUser,
  type UserManagementDto,
  type CreateUpdateUserRequest,
} from "../../api/admin";
import {
  FiUsers,
  FiTrash2,
  FiEdit2,
  FiCheck,
  FiX,
  FiAlertCircle,
} from "react-icons/fi";
import "./UserManagement.css";

interface EditingUser {
  id: number;
  data: CreateUpdateUserRequest;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserManagementDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<EditingUser | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAllUsers();
      setUsers(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: number) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      await deleteUser(userId);
      setUsers(users.filter((u) => u.id !== userId));
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete user");
    }
  };

  const handleToggleStatus = async (userId: number) => {
    try {
      const response = await toggleUserStatus(userId);
      setUsers(users.map((u) => (u.id === userId ? response.data : u)));
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update user status");
    }
  };

  const handleEdit = (user: UserManagementDto) => {
    setEditingUser({
      id: user.id,
      data: {
        name: user.name,
        email: user.email,
        phone: user.phone || "",
        enabled: user.enabled,
        roles: user.roles,
      },
    });
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    try {
      const response = await updateUser(editingUser.id, editingUser.data);
      setUsers(users.map((u) => (u.id === editingUser.id ? response.data : u)));
      setEditingUser(null);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update user");
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div className="user-management">
      <div className="management-header">
        <h2>
          <FiUsers /> User Management
        </h2>
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {error && (
        <div className="error-message">
          <FiAlertCircle /> {error}
        </div>
      )}

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Roles</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="no-data">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className={editingUser?.id === user.id ? "editing" : ""}>
                  {editingUser?.id === user.id ? (
                    <>
                      <td>
                        <input
                          type="text"
                          value={editingUser.data.name}
                          onChange={(e) =>
                            setEditingUser({
                              ...editingUser,
                              data: { ...editingUser.data, name: e.target.value },
                            })
                          }
                          className="edit-input"
                        />
                      </td>
                      <td>
                        <input
                          type="email"
                          value={editingUser.data.email}
                          onChange={(e) =>
                            setEditingUser({
                              ...editingUser,
                              data: { ...editingUser.data, email: e.target.value },
                            })
                          }
                          className="edit-input"
                        />
                      </td>
                      <td>
                        <input
                          type="tel"
                          value={editingUser.data.phone}
                          onChange={(e) =>
                            setEditingUser({
                              ...editingUser,
                              data: { ...editingUser.data, phone: e.target.value },
                            })
                          }
                          className="edit-input"
                        />
                      </td>
                      <td>{editingUser.data.roles.join(", ")}</td>
                      <td>
                        <span className={`status ${editingUser.data.enabled ? "active" : "inactive"}`}>
                          {editingUser.data.enabled ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>{user.createdAt}</td>
                      <td className="actions">
                        <button
                          onClick={handleSaveEdit}
                          className="btn-save"
                          title="Save changes"
                        >
                          <FiCheck />
                        </button>
                        <button
                          onClick={() => setEditingUser(null)}
                          className="btn-cancel"
                          title="Cancel editing"
                        >
                          <FiX />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.phone || "—"}</td>
                      <td>
                        <span className="roles">
                          {user.roles.map((role) => (
                            <span key={role} className="role-badge">
                              {role.replace("ROLE_", "")}
                            </span>
                          ))}
                        </span>
                      </td>
                      <td>
                        <span className={`status ${user.enabled ? "active" : "inactive"}`}>
                          {user.enabled ? "✓ Active" : "✗ Inactive"}
                        </span>
                      </td>
                      <td>{user.createdAt}</td>
                      <td className="actions">
                        <button
                          onClick={() => handleEdit(user)}
                          className="btn-edit"
                          title="Edit user"
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(user.id)}
                          className={`btn-toggle ${user.enabled ? "active" : ""}`}
                          title={`${user.enabled ? "Disable" : "Enable"} user`}
                        >
                          {user.enabled ? <FiCheck /> : <FiX />}
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="btn-delete"
                          title="Delete user"
                        >
                          <FiTrash2 />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
