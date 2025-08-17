import React, { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  where,
  setDoc,
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from './firebase';
import { getOrganizationId } from './utils';
import './UserManagement.css';

// 🔧 Evita mandar undefined a Firestore
const sanitizeForFirestore = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

function UserManagement({ user, onBack }) {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // doc seleccionado
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'restaurante',
    restaurant: '',
    active: true,
  });

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const orgId = getOrganizationId(user);
      if (!orgId) {
        console.error('Usuario sin organizationId válido:', user);
        setUsers([]);
        return;
      }
      const q = query(collection(db, 'users'), where('organizationId', '==', orgId));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      usersData.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setUsers(usersData);
    } catch (err) {
      console.error('Error al cargar usuarios:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'restaurante',
      restaurant: '',
      active: true,
    });
  };

  const handleEdit = (userToEdit) => {
    setEditingUser(userToEdit);
    setFormData({
      name: userToEdit.name || '',
      email: userToEdit.email || '',
      password: '',
      role: userToEdit.role || 'restaurante',
      restaurant: userToEdit.role === 'restaurante' ? (userToEdit.restaurant ?? '') : '',
      active: userToEdit.active ?? true,
    });
    setShowForm(true);
  };

  const handleToggleActive = async (userToToggle) => {
    if (userToToggle.id === user.uid) {
      alert('❌ No puedes desactivar tu propia cuenta');
      return;
    }
    try {
      const payload = sanitizeForFirestore({
        active: !(userToToggle.active ?? true),
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, 'users', userToToggle.id), payload);
      await loadUsers();
    } catch (err) {
      console.error('Error al cambiar estado:', err);
      alert('❌ Error al cambiar estado del usuario');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const orgId = getOrganizationId(user);
      const orgName = user?.organizationName || 'Organización';

      if (!orgId) {
        alert('❌ Error: No se pudo obtener información de la organización');
        return;
      }

      if (editingUser) {
        // 🔒 No actualizar email aquí (lo controla Firebase Auth)
        const updateData = sanitizeForFirestore({
          name: (formData.name || '').trim(),
          role: formData.role,
          restaurant:
            formData.role === 'restaurante'
              ? (formData.restaurant || '').trim() || null
              : null,
          active: formData.active ?? true,
          updatedAt: new Date().toISOString(),
        });

        await updateDoc(doc(db, 'users', editingUser.id), updateData);
        alert('✅ Usuario actualizado exitosamente');
      } else {
        // Crea al usuario en Auth y el doc en /users/{uid}
        const cred = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );
        const newUser = cred.user;

        const userData = sanitizeForFirestore({
          uid: newUser.uid,
          name: (formData.name || '').trim(),
          email: (formData.email || '').trim(),
          role: formData.role,
          restaurant:
            formData.role === 'restaurante'
              ? (formData.restaurant || '').trim() || null
              : null,
          organizationId: orgId,
          organizationName: orgName,
          active: formData.active ?? true,
          createdAt: new Date().toISOString(),
          createdBy: user.name || user.email || 'Admin',
        });

        // ⛑️ usa setDoc con ID = UID para respetar las reglas y el login
        await setDoc(doc(db, 'users', newUser.uid), userData);

        alert('✅ Usuario creado exitosamente');
      }

      await loadUsers();
      setShowForm(false);
      resetForm();
    } catch (error) {
      console.error('Error al guardar usuario:', error);

      if (error.code === 'auth/email-already-in-use') {
        alert('❌ Este email ya está registrado');
      } else if (error.code === 'auth/weak-password') {
        alert('❌ La contraseña debe tener al menos 6 caracteres');
      } else if (error.code === 'auth/invalid-email') {
        alert('❌ Email no válido');
      } else {
        alert('❌ Error al guardar usuario: ' + (error.message || error.code || ''));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleIcon = (role) => {
    const icons = { restaurante: '🍴', surtidor: '🚚', admin: '👑' };
    return icons[role] || '👤';
  };

  const getRoleText = (role) => {
    const roles = { restaurante: 'Restaurante', surtidor: 'Surtidor', admin: 'Administrador' };
    return roles[role] || role;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="um-header">
        <button onClick={onBack} className="back-button">← Volver</button>
        <h2>👥 Gestionar Usuarios - {user.organizationName}</h2>
        <button onClick={() => { setShowForm(!showForm); if (!showForm) resetForm(); }} className="add-button">
          {showForm ? 'Cancelar' : '+ Agregar Usuario'}
        </button>
      </div>

      {showForm && (
        <div className="user-form-container">
          <form onSubmit={handleSubmit} className="user-form">
            <h3>{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>

            <div className="form-row">
              <div className="form-group">
                <label>Nombre completo:</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Juan Pérez"
                  required
                />
              </div>

              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="usuario@ejemplo.com"
                  required
                  disabled={!!editingUser}
                />
                {editingUser && <small>No se puede cambiar el email</small>}
              </div>
            </div>

            {!editingUser && (
              <div className="form-group">
                <label>Contraseña:</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Rol:</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="restaurante">🍴 Restaurante</option>
                  <option value="surtidor">🚚 Surtidor</option>
                  <option value="admin">👑 Administrador</option>
                </select>
              </div>

              {formData.role === 'restaurante' && (
                <div className="form-group">
                  <label>Nombre del restaurante:</label>
                  <input
                    type="text"
                    value={formData.restaurant}
                    onChange={(e) => setFormData({ ...formData, restaurant: e.target.value })}
                    placeholder="Ej: Sucursal Centro"
                    required
                  />
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="submit" disabled={submitting} className="save-button">
                {submitting ? 'Guardando...' : editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="users-container">
        <div className="users-header">
          <h3>Lista de Usuarios ({users.length})</h3>
          <div className="users-stats">
            <span className="stat">👑 {users.filter((u) => u.role === 'admin').length} Admins</span>
            <span className="stat">🍴 {users.filter((u) => u.role === 'restaurante').length} Restaurantes</span>
            <span className="stat">🚚 {users.filter((u) => u.role === 'surtidor').length} Surtidores</span>
          </div>
        </div>

        {users.length === 0 ? (
          <div className="empty-state">
            <p>👥 No hay usuarios en la organización</p>
            <button onClick={() => { setShowForm(true); resetForm(); }} className="add-button">
              Agregar primer usuario
            </button>
          </div>
        ) : (
          <div className="users-grid">
            {users.map((u) => (
              <div key={u.id} className={`user-card ${!(u.active ?? true) ? 'inactive' : ''}`}>
                <div className="user-header">
                  <div className="user-avatar">{getRoleIcon(u.role)}</div>
                  <div className="user-info">
                    <h4>{u.name || '-'}</h4>
                    <p className="user-email">{u.email || '-'}</p>
                  </div>
                  <div className="user-status">
                    {(u.active ?? true) ? (
                      <span className="status-badge active">Activo</span>
                    ) : (
                      <span className="status-badge inactive">Inactivo</span>
                    )}
                  </div>
                </div>

                <div className="user-details">
                  <div className="detail-item">
                    <strong>Rol:</strong> {getRoleText(u.role)}
                  </div>
                  {u.role === 'restaurante' && (
                    <div className="detail-item">
                      <strong>Restaurante:</strong> {u.restaurant || '-'}
                    </div>
                  )}
                  <div className="detail-item">
                    <strong>Creado:</strong> {formatDate(u.createdAt)}
                  </div>
                  {u.createdBy && (
                    <div className="detail-item">
                      <strong>Por:</strong> {u.createdBy}
                    </div>
                  )}
                </div>

                <div className="user-actions">
                  <button onClick={() => handleEdit(u)} className="edit-btn">✏️ Editar</button>
                  <button
                    onClick={() => handleToggleActive(u)}
                    className={`toggle-btn ${(u.active ?? true) ? 'deactivate' : 'activate'}`}
                    disabled={u.id === user.uid}
                  >
                    {(u.active ?? true) ? '❌ Desactivar' : '✅ Activar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default UserManagement;
