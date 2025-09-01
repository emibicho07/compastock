import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, addDoc, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { getOrganizationId } from './utils';
import './InventoryControl.css';

function InventoryControl({ user, onBack }) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStockForm, setShowStockForm] = useState(false);
  const [stockProduct, setStockProduct] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'low', 'empty'
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [stockData, setStockData] = useState({
    type: 'in',
    quantity: '',
    reason: '',
    notes: ''
  });

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [products, filter, searchTerm, categoryFilter]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const orgId = getOrganizationId(user);
      if (!orgId) {
        console.error('Usuario sin organizationId válido:', user);
        return;
      }

      const q = query(
        collection(db, 'products'), 
        where('organizationId', '==', orgId),
        where('active', '==', true)
      );
      const querySnapshot = await getDocs(q);
      const productsData = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      // Ordenar por nombre
      productsData.sort((a, b) => a.name.localeCompare(b.name));
      setProducts(productsData);
    } catch (error) {
      console.error('Error al cargar productos:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...products];

    // Filtro por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(product => 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por categoría
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(product => product.category === categoryFilter);
    }

    // Filtro por estado de stock
    switch (filter) {
      case 'low':
        filtered = filtered.filter(product => {
          const stock = product.stockLevel || 0;
          const min = product.minStockAlert || 0;
          return stock <= min && stock > 0;
        });
        break;
      case 'empty':
        filtered = filtered.filter(product => (product.stockLevel || 0) === 0);
        break;
      case 'ok':
        filtered = filtered.filter(product => {
          const stock = product.stockLevel || 0;
          const min = product.minStockAlert || 0;
          return stock > min;
        });
        break;
      default: // 'all'
        break;
    }

    setFilteredProducts(filtered);
  };

  const handleStockMovement = async (e) => {
    e.preventDefault();
    if (!stockProduct || !stockData.quantity) return;

    try {
      const quantity = Number(stockData.quantity);
      if (quantity <= 0) {
        alert('La cantidad debe ser mayor a 0');
        return;
      }

      const currentStock = stockProduct.stockLevel || 0;
      let newStock;

      if (stockData.type === 'in') {
        newStock = currentStock + quantity;
      } else {
        newStock = Math.max(0, currentStock - quantity);
        if (currentStock < quantity) {
          if (!window.confirm(`Stock insuficiente. Stock actual: ${currentStock}, intentando sacar: ${quantity}.\n¿Continuar con stock en 0?`)) {
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

      alert(`${stockData.type === 'in' ? 'Entrada' : 'Salida'} registrada exitosamente`);
      
      await loadProducts();
      setShowStockForm(false);
      setStockProduct(null);
      setStockData({ type: 'in', quantity: '', reason: '', notes: '' });
    } catch (error) {
      console.error('Error en movimiento de stock:', error);
      alert('Error al registrar movimiento');
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

  const getStockStatus = (product) => {
    const stock = product.stockLevel || 0;
    const min = product.minStockAlert || 0;
    
    if (stock === 0) return { status: 'empty', text: 'Sin stock', class: 'stock-empty' };
    if (stock <= min) return { status: 'low', text: 'Stock bajo', class: 'stock-low' };
    return { status: 'ok', text: 'Stock OK', class: 'stock-ok' };
  };

  const getUniqueCategories = () => {
    const categories = [...new Set(products.map(p => p.category))];
    return categories.sort();
  };

  const getStockSummary = () => {
    const total = products.length;
    const empty = products.filter(p => (p.stockLevel || 0) === 0).length;
    const low = products.filter(p => {
      const stock = p.stockLevel || 0;
      const min = p.minStockAlert || 0;
      return stock <= min && stock > 0;
    }).length;
    const ok = total - empty - low;

    return { total, empty, low, ok };
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando inventario...</p>
      </div>
    );
  }

  const summary = getStockSummary();
  const orgName = user?.restaurant?.name || user?.organizationName || 'Tu Organización';

  return (
    <div className="inventory-control">
      <div className="ic-header">
        <button onClick={onBack} className="back-button">← Volver</button>
        <h2>📊 Control de Inventario - {orgName}</h2>
      </div>

      {/* Resumen de inventario */}
      <div className="inventory-summary">
        <div className="summary-card">
          <h3>Resumen de Inventario</h3>
          <div className="summary-stats">
            <div className="stat-item">
              <span className="stat-number">{summary.total}</span>
              <span className="stat-label">Total Productos</span>
            </div>
            <div className="stat-item ok">
              <span className="stat-number">{summary.ok}</span>
              <span className="stat-label">Stock OK</span>
            </div>
            <div className="stat-item warning">
              <span className="stat-number">{summary.low}</span>
              <span className="stat-label">Stock Bajo</span>
            </div>
            <div className="stat-item danger">
              <span className="stat-number">{summary.empty}</span>
              <span className="stat-label">Sin Stock</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controles de filtrado */}
      <div className="inventory-controls">
        <div className="search-section">
          <input
            type="text"
            placeholder="Buscar productos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-section">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">Todos los productos ({products.length})</option>
            <option value="ok">Stock OK ({summary.ok})</option>
            <option value="low">Stock bajo ({summary.low})</option>
            <option value="empty">Sin stock ({summary.empty})</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">Todas las categorías</option>
            {getUniqueCategories().map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Formulario de movimiento de stock */}
      {showStockForm && stockProduct && (
        <div className="stock-form-overlay">
          <div className="stock-form-container">
            <form onSubmit={handleStockMovement} className="stock-form">
              <h3>
                {stockData.type === 'in' ? '📥 Entrada' : '📤 Salida'} de Stock
              </h3>
              <p><strong>{stockProduct.name}</strong></p>
              <p>Stock actual: <strong>{stockProduct.stockLevel || 0} {stockProduct.unit}</strong></p>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Tipo:</label>
                  <select
                    value={stockData.type}
                    onChange={(e) => setStockData({...stockData, type: e.target.value})}
                  >
                    <option value="in">📥 Entrada</option>
                    <option value="out">📤 Salida</option>
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
                  placeholder="Ej: Compra, Venta, Merma..."
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowStockForm(false)} className="cancel-btn">
                  Cancelar
                </button>
                <button type="submit" className="save-btn">
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabla de productos */}
      <div className="inventory-table-container">
        <div className="table-header">
          <h3>Productos ({filteredProducts.length})</h3>
        </div>
        
        {filteredProducts.length === 0 ? (
          <div className="empty-state">
            <p>No se encontraron productos con los filtros aplicados</p>
          </div>
        ) : (
          <div className="inventory-table">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Stock Actual</th>
                  <th>Stock Mín/Máx</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(product => {
                  const stockInfo = getStockStatus(product);
                  return (
                    <tr key={product.id} className={stockInfo.status}>
                      <td>
                        <div className="product-info">
                          <strong>{product.name}</strong>
                          <small>{product.unit}</small>
                        </div>
                      </td>
                      <td>{product.category}</td>
                      <td>
                        <span className="stock-value">
                          {product.stockLevel || 0} {product.unit}
                        </span>
                      </td>
                      <td>
                        <span className="stock-range">
                          {product.minStockAlert || 0} / {product.maxStock || 0}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${stockInfo.class}`}>
                          {stockInfo.text}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            onClick={() => openStockForm(product, 'in')} 
                            className="action-btn in-btn"
                            title="Entrada de stock"
                          >
                            📥
                          </button>
                          <button 
                            onClick={() => openStockForm(product, 'out')} 
                            className="action-btn out-btn"
                            title="Salida de stock"
                          >
                            📤
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default InventoryControl;