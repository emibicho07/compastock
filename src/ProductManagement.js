import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from './firebase';
import './ProductManagement.css';

function ProductManagement({ user, onBack }) {
  const [products, setProducts] = useState([]);
  const [providers, setProviders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    unit: '',
    category: '',
    defaultProvider: '',
    active: true
  });

  const categories = [
    'Carnes', 'Verduras', 'Lácteos', 'Abarrotes', 'Bebidas', 
    'Limpieza', 'Panadería', 'Congelados', 'Condimentos', 'Otros'
  ];

  const units = [
    'kg', 'gr', 'litro', 'ml', 'pieza', 'paquete', 
    'caja', 'bolsa', 'lata', 'botella'
  ];

  useEffect(() => {
    loadProducts();
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      // Debug: Imprimir el objeto user completo
      console.log('Usuario completo en productos:', user);
      console.log('OrganizationId en productos:', user?.organizationId);

      // Verificación más flexible con fallbacks
      const orgId = user?.organizationId || user?.organization?.id || user?.orgId;

      if (!orgId) {
        console.error('Usuario sin organizationId válido en loadProviders. Propiedades disponibles:', Object.keys(user || {}));
        setLoadingProviders(false);
        return;
      }

      const q = query(
        collection(db, 'providers'),
        where('organizationId', '==', orgId),
        where('active', '==', true)
      );
      const querySnapshot = await getDocs(q);
      
      const providersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Ordenar alfabéticamente
      providersData.sort((a, b) => a.name.localeCompare(b.name));
      setProviders(providersData);
      
    } catch (error) {
      console.error('Error al cargar proveedores:', error);
    } finally {
      setLoadingProviders(false);
    }
  };

  const loadProducts = async () => {
    try {
      // Verificación más flexible con fallbacks
      const orgId = user?.organizationId || user?.organization?.id || user?.orgId;

      if (!orgId) {
        console.error('Usuario sin organizationId válido en loadProducts. Propiedades disponibles:', Object.keys(user || {}));
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, 'products'), 
        where('organizationId', '==', orgId)
      );
      const querySnapshot = await getDocs(q);
      
      const productsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productsData);
    } catch (error) {
      console.error('Error al cargar productos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Obtener organizationId con fallbacks
      const orgId = user?.organizationId || user?.organization?.id || user?.orgId;
      const orgName = user?.organizationName || user?.organization?.name || user?.orgName || 'Organización';

      if (!orgId) {
        alert('❌ Error: No se pudo obtener información de la organización');
        console.error('Datos de usuario disponibles en submit:', Object.keys(user || {}));
        setLoading(false);
        return;
      }

      const productData = {
        ...formData,
        organizationId: orgId,
        organizationName: orgName,
        updatedAt: new Date().toISOString()
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        alert('✅ Producto actualizado exitosamente');
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: new Date().toISOString()
        });
        alert('✅ Producto creado exitosamente');
      }
      
      await loadProducts();
      setShowForm(false);
      setEditingProduct(null);
      setFormData({
        name: '',
        unit: '',
        category: '',
        defaultProvider: '',
        active: true
      });
    } catch (error) {
      console.error('Error al guardar producto:', error);
      alert('❌ Error al guardar el producto');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      unit: product.unit,
      category: product.category,
      defaultProvider: product.defaultProvider || '',
      active: product.active
    });
    setShowForm(true);
  };

  const handleToggleActive = async (product) => {
    try {
      await updateDoc(doc(db, 'products', product.id), {
        active: !product.active,
        updatedAt: new Date().toISOString()
      });
      await loadProducts();
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      alert('❌ Error al cambiar estado del producto');
    }
  };

  const handleDelete = async (product) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar "${product.name}"?\n\nEsta acción no se puede deshacer.`)) {
      try {
        await deleteDoc(doc(db, 'products', product.id));
        alert('✅ Producto eliminado exitosamente');
        await loadProducts();
      } catch (error) {
        console.error('Error al eliminar producto:', error);
        alert('❌ Error al eliminar el producto');
      }
    }
  };

  if (loading && products.length === 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando productos...</p>
      </div>
    );
  }

  // Obtener datos de organización con fallbacks
  const orgName = user?.organizationName || user?.organization?.name || user?.orgName || 'Tu Organización';

  return (
    <div className="product-management">
      <div className="pm-header">
        <button onClick={onBack} className="back-button">← Volver</button>
        <h2>📦 Gestión de Productos - {orgName}</h2>
        <button 
          onClick={() => setShowForm(!showForm)} 
          className="add-button"
        >
          {showForm ? 'Cancelar' : '+ Agregar Producto'}
        </button>
      </div>

      {showForm && (
        <div className="product-form-container">
          <form onSubmit={handleSubmit} className="product-form">
            <h3>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
            
            <div className="form-group">
              <label>Nombre del producto:</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Ej: Pollo entero"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Unidad de medida:</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({...formData, unit: e.target.value})}
                required
              >
                <option value="">Seleccionar unidad</option>
                {units.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Categoría:</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                required
              >
                <option value="">Seleccionar categoría</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label>Proveedor por defecto:</label>
              <select
                value={formData.defaultProvider}
                onChange={(e) => setFormData({...formData, defaultProvider: e.target.value})}
                disabled={loadingProviders}
              >
                <option value="">
                  {loadingProviders ? 'Cargando proveedores...' : 'Sin proveedor por defecto'}
                </option>
                {providers.map(provider => (
                  <option key={provider.id} value={provider.name}>
                    {provider.name}
                  </option>
                ))}
              </select>
              {providers.length === 0 && !loadingProviders && (
                <small style={{ color: '#666', marginTop: '0.5rem', display: 'block' }}>
                  No hay proveedores activos. <strong>Agrega proveedores</strong> en "🏪 Gestionar Proveedores"
                </small>
              )}
            </div>

            <button type="submit" disabled={loading} className="save-button">
              {loading ? 'Guardando...' : (editingProduct ? 'Actualizar' : 'Crear Producto')}
            </button>
          </form>
        </div>
      )}

      <div className="products-container">
        <h3>Productos de {orgName} ({products.length})</h3>

        {products.length === 0 ? (
          <div className="empty-state">
            <p>📦 No hay productos disponibles para tu organización</p>
            <button onClick={() => setShowForm(true)} className="add-button">
              Agregar primer producto
            </button>
          </div>
        ) : (
          <div className="products-grid">
            {products.map(product => (
              <div key={product.id} className={`product-card ${!product.active ? 'inactive' : ''}`}>
                <div className="product-header">
                  <h4>{product.name}</h4>
                  <span className={`status-badge ${product.active ? 'active' : 'inactive'}`}>
                    {product.active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                
                <div className="product-details">
                  <p><strong>Unidad:</strong> {product.unit}</p>
                  <p><strong>Categoría:</strong> {product.category}</p>
                  {product.defaultProvider && (
                    <p><strong>Proveedor:</strong> {product.defaultProvider}</p>
                  )}
                </div>

                <div className="product-actions">
                  <button onClick={() => handleEdit(product)} className="edit-btn">
                    ✏️ Editar
                  </button>
                  <button 
                    onClick={() => handleToggleActive(product)} 
                    className={`toggle-btn ${product.active ? 'deactivate' : 'activate'}`}
                  >
                    {product.active ? '❌ Desactivar' : '✅ Activar'}
                  </button>
                  <button 
                    onClick={() => handleDelete(product)} 
                    className="delete-btn"
                  >
                    🗑️ Eliminar
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

export default ProductManagement;