import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from './firebase';
import './ProviderManagement.css';

function ProviderManagement({ user, onBack }) {
  const [providers, setProviders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    type: 'supermercado',
    description: '',
    active: true
  });

  const providerTypes = [
    'Supermercado', 'Mayorista', 'Mercado Local', 'Distribuidor', 
    'Carnicería', 'Verdulería', 'Proveedor Especializado', 'Otros'
  ];

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      if (!user.organizationId) {
        console.error('Usuario sin organizationId válido');
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, 'providers'), 
        where('organizationId', '==', user.organizationId)
      );
      const querySnapshot = await getDocs(q);
      
      const providersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Ordenar por activos primero, luego por nombre
      providersData.sort((a, b) => {
        if (a.active !== b.active) return b.active - a.active;
        return a.name.localeCompare(b.name);
      });
      
      setProviders(providersData);
    } catch (error) {
      console.error('Error al cargar proveedores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!user.organizationId) {
        alert('❌ Error: No se pudo obtener información de la organización');
        setLoading(false);
        return;
      }

      const providerData = {
        ...formData,
        organizationId: user.organizationId,
        organizationName: user.organizationName,
        updatedAt: new Date().toISOString(),
        updatedBy: user.name
      };

      if (editingProvider) {
        await updateDoc(doc(db, 'providers', editingProvider.id), providerData);
        alert('✅ Proveedor actualizado exitosamente');
      } else {
        await addDoc(collection(db, 'providers'), {
          ...providerData,
          createdAt: new Date().toISOString(),
          createdBy: user.name
        });
        alert('✅ Proveedor creado exitosamente');
      }
      
      await loadProviders();
      setShowForm(false);
      setEditingProvider(null);
      resetForm();
      
    } catch (error) {
      console.error('Error al guardar proveedor:', error);
      alert('❌ Error al guardar el proveedor');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (provider) => {
    if (user.role !== 'admin' && user.role !== 'surtidor') {
      alert('❌ No tienes permisos para editar proveedores');
      return;
    }
    
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      type: provider.type,
      description: provider.description || '',
      active: provider.active
    });
    setShowForm(true);
  };

  const handleDelete = async (provider) => {
    if (user.role !== 'admin') {
      alert('❌ Solo los administradores pueden eliminar proveedores');
      return;
    }

    if (window.confirm(`¿Estás seguro de que quieres eliminar "${provider.name}"?\n\nEsta acción no se puede deshacer.`)) {
      try {
        await deleteDoc(doc(db, 'providers', provider.id));
        alert('✅ Proveedor eliminado exitosamente');
        await loadProviders();
      } catch (error) {
        console.error('Error al eliminar proveedor:', error);
        alert('❌ Error al eliminar el proveedor');
      }
    }
  };

  const handleToggleActive = async (provider) => {
    if (user.role !== 'admin' && user.role !== 'surtidor') {
      alert('❌ No tienes permisos para cambiar el estado de proveedores');
      return;
    }

    try {
      await updateDoc(doc(db, 'providers', provider.id), {
        active: !provider.active,
        updatedAt: new Date().toISOString(),
        updatedBy: user.name
      });
      await loadProviders();
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      alert('❌ Error al cambiar estado del proveedor');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'supermercado',
      description: '',
      active: true
    });
  };

  const canCreateProviders = () => {
    return user.role === 'admin';
  };

  const canEditProviders = () => {
    return user.role === 'admin' || user.role === 'surtidor';
  };

  const canDeleteProviders = () => {
    return user.role === 'admin';
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

  if (loading && providers.length === 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando proveedores...</p>
      </div>
    );
  }

  return (
    <div className="provider-management">
      <div className="pm-header">
        <button onClick={onBack} className="back-button">← Volver</button>
        <h2>🏪 Gestión de Proveedores - {user.organizationName}</h2>
        {canCreateProviders() && (
          <button 
            onClick={() => setShowForm(!showForm)} 
            className="add-button"
          >
            {showForm ? 'Cancelar' : '+ Agregar Proveedor'}
          </button>
        )}
      </div>

      {/* Información de permisos */}
      <div className="permissions-info">
        <p>
          <strong>Tu rol:</strong> {user.role === 'admin' ? '👑 Administrador' : user.role === 'surtidor' ? '🚚 Surtidor' : '🍴 Restaurante'}
        </p>
        <ul>
          {user.role === 'admin' && (
            <>
              <li>✅ Crear nuevos proveedores</li>
              <li>✅ Editar proveedores existentes</li>
              <li>✅ Eliminar proveedores</li>
              <li>✅ Activar/desactivar proveedores</li>
            </>
          )}
          {user.role === 'surtidor' && (
            <>
              <li>❌ Crear nuevos proveedores (solo admin)</li>
              <li>✅ Editar proveedores existentes</li>
              <li>❌ Eliminar proveedores (solo admin)</li>
              <li>✅ Activar/desactivar proveedores</li>
            </>
          )}
          {user.role === 'restaurante' && (
            <>
              <li>❌ Crear nuevos proveedores (solo admin)</li>
              <li>❌ Editar proveedores (admin/surtidor)</li>
              <li>❌ Eliminar proveedores (solo admin)</li>
              <li>❌ Solo lectura</li>
            </>
          )}
        </ul>
      </div>

      {showForm && canCreateProviders() && (
        <div className="provider-form-container">
          <form onSubmit={handleSubmit} className="provider-form">
            <h3>{editingProvider ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
            
            <div className="form-group">
              <label>Nombre del proveedor:</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Ej: Costco Monterrey"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Tipo de proveedor:</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                required
              >
                {providerTypes.map(type => (
                  <option key={type} value={type.toLowerCase()}>{type}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Descripción (opcional):</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Ej: Mayorista de carnes y lácteos"
              />
            </div>

            <button type="submit" disabled={loading} className="save-button">
              {loading ? 'Guardando...' : (editingProvider ? 'Actualizar' : 'Crear Proveedor')}
            </button>
          </form>
        </div>
      )}

      <div className="providers-container">
        <h3>Proveedores de {user.organizationName} ({providers.length})</h3>

        {providers.length === 0 ? (
          <div className="empty-state">
            <p>🏪 No hay proveedores configurados para tu organización</p>
            {canCreateProviders() && (
              <button onClick={() => setShowForm(true)} className="add-button">
                Agregar primer proveedor
              </button>
            )}
            {!canCreateProviders() && (
              <p>Contacta a tu administrador para agregar proveedores</p>
            )}
          </div>
        ) : (
          <div className="providers-grid">
            {providers.map(provider => (
              <div key={provider.id} className={`provider-card ${!provider.active ? 'inactive' : ''}`}>
                <div className="provider-header">
                  <h4>{provider.name}</h4>
                  <span className={`status-badge ${provider.active ? 'active' : 'inactive'}`}>
                    {provider.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                
                <div className="provider-details">
                  <p><strong>Tipo:</strong> {provider.type}</p>
                  {provider.description && (
                    <p><strong>Descripción:</strong> {provider.description}</p>
                  )}
                  <p><strong>Creado:</strong> {formatDate(provider.createdAt)}</p>
                  {provider.createdBy && (
                    <p><strong>Por:</strong> {provider.createdBy}</p>
                  )}
                  {provider.updatedAt && provider.updatedAt !== provider.createdAt && (
                    <p><strong>Actualizado:</strong> {formatDate(provider.updatedAt)} por {provider.updatedBy}</p>
                  )}
                </div>

                <div className="provider-actions">
                  {canEditProviders() && (
                    <button onClick={() => handleEdit(provider)} className="edit-btn">
                      ✏️ Editar
                    </button>
                  )}
                  {canEditProviders() && (
                    <button 
                      onClick={() => handleToggleActive(provider)} 
                      className={`toggle-btn ${provider.active ? 'deactivate' : 'activate'}`}
                    >
                      {provider.active ? '❌ Desactivar' : '✅ Activar'}
                    </button>
                  )}
                  {canDeleteProviders() && (
                    <button 
                      onClick={() => handleDelete(provider)} 
                      className="delete-btn"
                    >
                      🗑️ Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProviderManagement;