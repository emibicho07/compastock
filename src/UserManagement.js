import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from './firebase';
import './UserManagement.css';

function UserManagement({ user, onBack }) {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'restaurante',
    restaurant: '',
    active: true
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const q = query(
        collection(db, 'users'),
        where('organizationId', '==', user.organizationId)
      );
      const querySnapshot = await getDocs(q);
      
      const usersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Ordenar por fecha de creación (más recientes primero)
      usersData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setUsers(usersData);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingUser) {
        // Actualizar usuario existente (sin cambiar contraseña)
        const updateData = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          restaurant: formData.role === 'restaurante' ? formData.restaurant : null,
          active: formData.active,
          updatedAt: new Date().toISOString()
        };

        await updateDoc(doc(db, 'users', editingUser.id), updateData);
        alert('✅ Usuario actualizado exitosamente');
      } else {
        // Crear nuevo usuario
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const newUser = userCredential.user;
        
        // Guardar datos adicionales del usuario
        const userData = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          restaurant: formData.role === 'restaurante' ? formData.restaurant : null,
          organizationId: user.organizationId,
          organizationName: user.organizationName,
          active: formData.active,
          createdAt: new Date().toISOString(),
          createdBy: user.name
        };
        
        await addDoc(collection(db, 'users'), userData);
        alert('✅ Usuario creado exitosamente');
      }
      
      await loadUsers();
      setShowForm(false);
      setEditingUser(null);
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
        alert('❌ Error al guardar usuario: ' + error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (userToEdit) => {
    setEditingUser(userToEdit);
    setFormData({
      name: userToEdit.name,
      email: userToEdit.email,
      password: '', // No mostrar contraseña
      role: userToEdit.role,
      restaurant: userToEdit.restaurant || '',
      active: userToEdit.active
    });
    setShowForm(true);
  };

  const handleToggleActive = async (userToToggle) => {
    if (userToToggle.id === user.uid) {
      alert('❌ No puedes desactivar tu propia cuenta');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', userToToggle.id), {
        active: !userToToggle.active,
        updatedAt: new Date().toISOString()
      });
      await loadUsers();
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      alert('❌ Error al cambiar estado del usuario');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'restaurante',
      restaurant: '',
      active: true
    });
  };

  const getRoleIcon = (role) => {
    const icons = {
      'restaurante': '🍴',
      'surtidor': '🚚',
      'admin': '👑'
    };
    return icons[role] || '👤';
  };

  const getRoleText = (role) => {
    const roles = {
      'restaurante': 'Restaurante',
      'surtidor': 'Surtidor',
      'admin': 'Administrador'
    };
    return roles[role] || role;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
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
        <button 
          onClick={() => setShowForm(!showForm)} 
          className="add-button"
        >
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
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Ej: Juan Pérez"
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="usuario@ejemplo.com"
                  required
                  disabled={editingUser !== null}
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
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  placeholder="Mínimo 6 caracteres"
                  minLength="6"
                  required
                />
              </div>
            )}
            
            <div className="form-row">
              <div className="form-group">
                <label>Rol:</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
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
                    onChange={(e) => setFormData({...formData, restaurant: e.target.value})}
                    placeholder="Ej: Sucursal Centro"
                    required
                  />
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="submit" disabled={submitting} className="save-button">
                {submitting ? 'Guardando...' : (editingUser ? 'Actualizar Usuario' : 'Crear Usuario')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="users-container">
        <div className="users-header">
          <h3>Lista de Usuarios ({users.length})</h3>
          <div className="users-stats">
            <span className="stat">
              👑 {users.filter(u => u.role === 'admin').length} Admins
            </span>
            <span className="stat">
              🍴 {users.filter(u => u.role === 'restaurante').length} Restaurantes
            </span>
            <span className="stat">
              🚚 {users.filter(u => u.role === 'surtidor').length} Surtidores
            </span>
          </div>
        </div>

        {users.length === 0 ? (
          <div className="empty-state">
            <p>👥 No hay usuarios en la organización</p>
            <button onClick={() => setShowForm(true)} className="add-button">
              Agregar primer usuario
            </button>
          </div>
        ) : (
          <div className="users-grid">
            {users.map(userData => (
              <div key={userData.id} className={`user-card ${!userData.active ? 'inactive' : ''}`}>
                <div className="user-header">
                  <div className="user-avatar">
                    {getRoleIcon(userData.role)}
                  </div>
                  <div className="user-info">
                    <h4>{userData.name}</h4>
                    <p className="user-email">{userData.email}</p>
                  </div>
                  <div className="user-status">
                    {userData.active ? (
                      <span className="status-badge active">Activo</span>
                    ) : (
                      <span className="status-badge inactive">Inactivo</span>
                    )}
                  </div>
                </div>
                
                <div className="user-details">
                  <div className="detail-item">
                    <strong>Rol:</strong> {getRoleText(userData.role)}
                  </div>
                  {userData.restaurant && (
                    <div className="detail-item">
                      <strong>Restaurante:</strong> {userData.restaurant}
                    </div>
                  )}
                  <div className="detail-item">
                    <strong>Creado:</strong> {formatDate(userData.createdAt)}
                  </div>
                  {userData.createdBy && (
                    <div className="detail-item">
                      <strong>Por:</strong> {userData.createdBy}
                    </div>
                  )}
                </div>

                <div className="user-actions">
                  <button 
                    onClick={() => handleEdit(userData)} 
                    className="edit-btn"
                  >
                    ✏️ Editar
                  </button>
                  <button 
                    onClick={() => handleToggleActive(userData)} 
                    className={`toggle-btn ${userData.active ? 'deactivate' : 'activate'}`}
                    disabled={userData.id === user.uid}
                  >
                    {userData.active ? '❌ Desactivar' : '✅ Activar'}
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