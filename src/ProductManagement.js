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
      if (!user.organizationId) {
        console.error('Usuario sin organizationId válido');
        setLoadingProviders(false);
        return;
      }

      const q = query(
        collection(db, 'providers'),
        where('organizationId', '==', user.organizationId),
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
      if (!user.organizationId) {
        console.error('Usuario sin organizationId válido');
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, 'products'), 
        where('organizationId', '==', user.organizationId)
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
      if (!user.organizationId) {
        alert('❌ Error: No se pudo obtener información de la organización');
        setLoading(false);
        return;
      }

      const productData = {
        ...formData,
        organizationId: user.organizationId,
        organizationName: user.organizationName,
        updatedAt: new Date().toISOString()
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: new Date().toISOString()
        });
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
      alert('Error al guardar el producto');
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

  return (
    <div className="product-management">
      <div className="pm-header">
        <button onClick={onBack} className="back-button">← Volver</button>
        <h2>📦 Gestión de Productos - {user.organizationName}</h2>
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
        <h3>Productos de {user.organizationName} ({products.length})</h3>

        {products.length === 0 ? (
          <div className="empty-state">
            <p>No hay productos disponibles para tu organización</p>
            <button onClick={() => setShowForm(true)} className="add-button">
              Agregar primer producto
            </button>
          </div>
        ) : (
          <div className="products-grid">
            {products.map(product => (
              <div key={product.id} className="product-card">
                <h4>{product.name}</h4>
                <p><strong>Unidad:</strong> {product.unit}</p>
                <p><strong>Categoría:</strong> {product.category}</p>
                {product.defaultProvider && (
                  <p><strong>Proveedor:</strong> {product.defaultProvider}</p>
                )}
                <div className="product-actions">
                  <button onClick={() => handleEdit(product)} className="edit-btn">
                    Editar
                  </button>
                  <button onClick={() => handleToggleActive(product)} className="toggle-btn">
                    {product.active ? 'Desactivar' : 'Activar'}
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