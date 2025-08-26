import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { getOrganizationId } from './utils';
import './ProductManagement.css';

function ProductManagement({ user, onBack }) {
  const [products, setProducts] = useState([]);
  const [providers, setProviders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showStockForm, setShowStockForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [stockProduct, setStockProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    unit: '',
    category: '',
    defaultProvider: '',
    // Nuevos campos para control de stock
    stockLevel: 0,
    minStockAlert: 5,
    maxStock: 100,
    active: true
  });

  const [stockData, setStockData] = useState({
    type: 'in', // 'in' o 'out'
    quantity: '',
    reason: '',
    notes: ''
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
      const orgId = getOrganizationId(user);
      if (!orgId) {
        console.error('Usuario sin organizationId válido en loadProviders:', user);
        setLoadingProviders(false);
        return;
      }

      const q = query(
        collection(db, 'providers'),
        where('organizationId', '==', orgId),
        where('active', '==', true)
      );
      const querySnapshot = await getDocs(q);

      const providersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
      const orgId = getOrganizationId(user);
      if (!orgId) {
        console.error('Usuario sin organizationId válido en loadProducts:', user);
        setLoading(false);
        return;
      }

      const q = query(collection(db, 'products'), where('organizationId', '==', orgId));
      const querySnapshot = await getDocs(q);
      const productsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
      const orgId = getOrganizationId(user);
      const orgName = user?.organizationName || 'Organización';

      if (!orgId) {
        alert('❌ Error: No se pudo obtener información de la organización');
        console.error('Usuario:', user);
        setLoading(false);
        return;
      }

      const productData = {
        ...formData,
        organizationId: orgId,
        organizationName: orgName,
        // Asegurar que los campos de stock sean números
        stockLevel: Number(formData.stockLevel) || 0,
        minStockAlert: Number(formData.minStockAlert) || 0,
        maxStock: Number(formData.maxStock) || 0,
        updatedAt: new Date().toISOString()
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
        alert('✅ Producto actualizado exitosamente');
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: new Date().toISOString(),
          lastRestockDate: new Date().toISOString()
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
        stockLevel: 0,
        minStockAlert: 5,
        maxStock: 100,
        active: true 
      });
    } catch (error) {
      console.error('Error al guardar producto:', error);
      alert('❌ Error al guardar el producto');
    } finally {
      setLoading(false);
    }
  };

  const handleStockMovement = async (e) => {
    e.preventDefault();
    if (!stockProduct || !stockData.quantity) return;

    try {
      const quantity = Number(stockData.quantity);
      if (quantity <= 0) {
        alert('❌ La cantidad debe ser mayor a 0');
        return;
      }

      const currentStock = stockProduct.stockLevel || 0;
      let newStock;

      if (stockData.type === 'in') {
        newStock = currentStock + quantity;
      } else {
        newStock = Math.max(0, currentStock - quantity);
        if (currentStock < quantity) {
          if (!window.confirm(`⚠️ Stock insuficiente. Stock actual: ${currentStock}, intentando sacar: ${quantity}.\n¿Continuar con stock en 0?`)) {
            return;
          }
        }
      }

      // Actualizar stock del producto
      await updateDoc(doc(db, 'products', stockProduct.id), {
        stockLevel: newStock,
        lastRestockDate: stockData.type === 'in' ? new Date().toISOString() : stockProduct.lastRestockDate,
        updatedAt: new Date().toISOString()
      });

      // Registrar transacción
      await addDoc(collection(db, 'inventory_transactions'), {
        productId: stockProduct.id,
        productName: stockProduct.name,
        organizationId: getOrganizationId(user),
        locationId: user.restaurant || user.organizationName,
        type: stockData.type,
        quantity: quantity,
        previousStock: currentStock,
        newStock: newStock,
        reason: stockData.reason || (stockData.type === 'in' ? 'Entrada de inventario' : 'Salida de inventario'),
        notes: stockData.notes,
        userId: user.uid,
        userName: user.name,
        date: new Date().toISOString()
      });

      alert(`✅ ${stockData.type === 'in' ? 'Entrada' : 'Salida'} registrada exitosamente`);
      
      await loadProducts();
      setShowStockForm(false);
      setStockProduct(null);
      setStockData({ type: 'in', quantity: '', reason: '', notes: '' });
    } catch (error) {
      console.error('Error en movimiento de stock:', error);
      alert('❌ Error al registrar movimiento');
    }
  };

  const openStockForm = (product, type) => {
    setStockProduct(product);
    setStockData({ 
      type, 
      quantity: '', 
      reason: type === 'in' ? 'Compra/Recepción' : 'Uso/Venta',
      notes: '' 
    });
    setShowStockForm(true);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      unit: product.unit,
      category: product.category,
      defaultProvider: product.defaultProvider || '',
      stockLevel: product.stockLevel || 0,
      minStockAlert: product.minStockAlert || 5,
      maxStock: product.maxStock || 100,
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

  const getStockStatus = (product) => {
    const stock = product.stockLevel || 0;
    const min = product.minStockAlert || 0;
    
    if (stock === 0) return { status: 'empty', text: 'Sin stock', class: 'stock-empty' };
    if (stock <= min) return { status: 'low', text: 'Stock bajo', class: 'stock-low' };
    return { status: 'ok', text: 'Stock OK', class: 'stock-ok' };
  };

  if (loading && products.length === 0) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando productos...</p>
      </div>
    );
  }

  // Obtener datos de organización usando la estructura real
  const orgName = user?.restaurant?.name || user?.organizationName || 'Tu Organización';
  const lowStockProducts = products.filter(p => {
    const stock = p.stockLevel || 0;
    const min = p.minStockAlert || 0;
    return stock <= min && p.active;
  });

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

      {/* Alertas de stock bajo */}
      {lowStockProducts.length > 0 && (
        <div className="stock-alerts">
          <h3>⚠️ Alertas de Stock Bajo ({lowStockProducts.length})</h3>
          <div className="alert-list">
            {lowStockProducts.map(product => (
              <div key={product.id} className="alert-item">
                <span>{product.name} - Stock: {product.stockLevel || 0} {product.unit}</span>
                <button 
                  onClick={() => openStockForm(product, 'in')}
                  className="restock-btn"
                >
                  + Agregar Stock
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulario de producto */}
      {showForm && (
        <div className="product-form-container">
          <form onSubmit={handleSubmit} className="product-form">
            <h3>{editingProduct ? 'Editar Producto' : 'Nuevo Producto'}</h3>
            
            <div className="form-row">
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
            </div>

            <div className="form-row">
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
              </div>
            </div>

            {/* Controles de stock */}
            <div className="stock-controls">
              <h4>📊 Control de Inventario</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Stock actual:</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stockLevel}
                    onChange={(e) => setFormData({...formData, stockLevel: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>Alerta stock mínimo:</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.minStockAlert}
                    onChange={(e) => setFormData({...formData, minStockAlert: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>Stock máximo:</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.maxStock}
                    onChange={(e) => setFormData({...formData, maxStock: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading} className="save-button">
              {loading ? 'Guardando...' : (editingProduct ? 'Actualizar' : 'Crear Producto')}
            </button>
          </form>
        </div>
      )}

      {/* Formulario de movimiento de stock */}
      {showStockForm && stockProduct && (
        <div className="stock-form-container">
          <form onSubmit={handleStockMovement} className="stock-form">
            <h3>
              {stockData.type === 'in' ? '📥 Entrada' : '📤 Salida'} de Stock - {stockProduct.name}
            </h3>
            <p>Stock actual: <strong>{stockProduct.stockLevel || 0} {stockProduct.unit}</strong></p>
            
            <div className="form-row">
              <div className="form-group">
                <label>Tipo de movimiento:</label>
                <select
                  value={stockData.type}
                  onChange={(e) => setStockData({...stockData, type: e.target.value})}
                >
                  <option value="in">📥 Entrada (agregar stock)</option>
                  <option value="out">📤 Salida (quitar stock)</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Cantidad:</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={stockData.quantity}
                  onChange={(e) => setStockData({...stockData, quantity: e.target.value})}
                  placeholder="0"
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label>Motivo:</label>
              <input
                type="text"
                value={stockData.reason}
                onChange={(e) => setStockData({...stockData, reason: e.target.value})}
                placeholder="Ej: Compra, Venta, Merma, etc."
              />
            </div>
            
            <div className="form-group">
              <label>Notas (opcional):</label>
              <textarea
                value={stockData.notes}
                onChange={(e) => setStockData({...stockData, notes: e.target.value})}
                placeholder="Notas adicionales..."
                rows="2"
              />
            </div>

            <div className="form-actions">
              <button type="button" onClick={() => setShowStockForm(false)} className="cancel-btn">
                Cancelar
              </button>
              <button type="submit" className="save-button">
                Registrar {stockData.type === 'in' ? 'Entrada' : 'Salida'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de productos */}
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
            {products.map(product => {
              const stockInfo = getStockStatus(product);
              return (
                <div key={product.id} className={`product-card ${!product.active ? 'inactive' : ''}`}>
                  <div className="product-header">
                    <h4>{product.name}</h4>
                    <div className="status-badges">
                      <span className={`status-badge ${product.active ? 'active' : 'inactive'}`}>
                        {product.active ? 'Activo' : 'Inactivo'}
                      </span>
                      <span className={`stock-badge ${stockInfo.class}`}>
                        {stockInfo.text}
                      </span>
                    </div>
                  </div>
                  
                  <div className="product-details">
                    <p><strong>Stock:</strong> {product.stockLevel || 0} {product.unit}</p>
                    <p><strong>Mín/Máx:</strong> {product.minStockAlert || 0} / {product.maxStock || 0}</p>
                    <p><strong>Categoría:</strong> {product.category}</p>
                    {product.defaultProvider && (
                      <p><strong>Proveedor:</strong> {product.defaultProvider}</p>
                    )}
                  </div>

                  <div className="product-actions">
                    <div className="stock-actions">
                      <button 
                        onClick={() => openStockForm(product, 'in')} 
                        className="stock-in-btn"
                        title="Agregar stock"
                      >
                        📥 +
                      </button>
                      <button 
                        onClick={() => openStockForm(product, 'out')} 
                        className="stock-out-btn"
                        title="Quitar stock"
                      >
                        📤 -
                      </button>
                    </div>
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductManagement;