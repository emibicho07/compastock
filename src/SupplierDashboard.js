import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from './firebase';
import './SupplierDashboard.css';

function SupplierDashboard({ user, onBack, initialView = 'providers' }) {
  const [orders, setOrders] = useState([]);
  const [currentView, setCurrentView] = useState(initialView);
  const [loading, setLoading] = useState(true);
  const [groupedOrders, setGroupedOrders] = useState({});
  const [urgentOrders, setUrgentOrders] = useState([]);
  const [pendingProducts, setPendingProducts] = useState([]);

  // Detectar cambios en el parámetro inicial
  useEffect(() => {
    setCurrentView(initialView);
  }, [initialView]);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      // Solo pedidos de la misma organización que están pendientes
      const q = query(
        collection(db, 'orders'), 
        where('organizationId', '==', user.organizationId),
        where('status', '==', 'pending')
      );
      const querySnapshot = await getDocs(q);
      
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setOrders(ordersData);
      groupOrdersByProvider(ordersData);
      filterUrgentOrders(ordersData);
      
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupOrdersByProvider = (ordersData) => {
    const grouped = {};
    const pending = [];

    ordersData.forEach(order => {
      order.items.forEach(item => {
        if (!item.status || item.status === 'pending') {
          const provider = item.selectedProvider || 'Sin Proveedor';
          
          if (!grouped[provider]) {
            grouped[provider] = [];
          }

          const itemWithOrder = {
            ...item,
            orderId: order.id,
            restaurantName: order.restaurantName,
            isUrgent: order.isUrgent,
            orderDate: order.createdAt
          };

          grouped[provider].push(itemWithOrder);

          if (!item.selectedProvider) {
            pending.push(itemWithOrder);
          }
        }
      });
    });

    setGroupedOrders(grouped);
    setPendingProducts(pending);
  };

  const filterUrgentOrders = (ordersData) => {
    const urgent = ordersData.filter(order => order.isUrgent);
    setUrgentOrders(urgent);
  };

  const updateItemStatus = async (orderId, productId, newStatus, substitution = '') => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const updatedItems = order.items.map(item => {
        if (item.productId === productId) {
          return {
            ...item,
            status: newStatus,
            substitution: substitution,
            updatedAt: new Date().toISOString(),
            updatedBy: user.name
          };
        }
        return item;
      });

      await updateDoc(doc(db, 'orders', orderId), {
        items: updatedItems,
        updatedAt: new Date().toISOString()
      });

      await loadOrders();

    } catch (error) {
      console.error('Error al actualizar estado:', error);
      alert('Error al actualizar el estado del producto');
    }
  };

  const assignProvider = async (orderId, productId, provider) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const updatedItems = order.items.map(item => {
        if (item.productId === productId) {
          return {
            ...item,
            selectedProvider: provider,
            updatedAt: new Date().toISOString()
          };
        }
        return item;
      });

      await updateDoc(doc(db, 'orders', orderId), {
        items: updatedItems,
        updatedAt: new Date().toISOString()
      });

      await loadOrders();

    } catch (error) {
      console.error('Error al asignar proveedor:', error);
      alert('Error al asignar proveedor');
    }
  };

  const getStatusIcon = (status) => {
    const statusMap = {
      'pending': '⏳',
      'found': '✅',
      'not_found': '❌',
      'substituted': '🔄'
    };
    return statusMap[status] || '⏳';
  };

  const getStatusText = (status) => {
    const statusMap = {
      'pending': 'Pendiente',
      'found': 'Surtido',
      'not_found': 'No encontrado',
      'substituted': 'Sustituido'
    };
    return statusMap[status] || 'Pendiente';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSubstitution = (orderId, productId) => {
    const substitution = prompt('¿Por qué producto fue sustituido?');
    if (substitution && substitution.trim()) {
      updateItemStatus(orderId, productId, 'substituted', substitution.trim());
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando pedidos...</p>
      </div>
    );
  }

  return (
    <div className="supplier-dashboard">
      <div className="sd-header">
        <button onClick={onBack} className="back-button">← Volver</button>
        <h2>🚚 Dashboard Surtidor - {user.organizationName}</h2>
        <div className="view-toggle">
          <button 
            className={currentView === 'providers' ? 'active' : ''}
            onClick={() => setCurrentView('providers')}
          >
            Por Proveedores
          </button>
          <button 
            className={currentView === 'urgent' ? 'active' : ''}
            onClick={() => setCurrentView('urgent')}
          >
            Urgentes ({urgentOrders.length})
          </button>
          <button 
            className={currentView === 'pending' ? 'active' : ''}
            onClick={() => setCurrentView('pending')}
          >
            Sin Proveedor ({pendingProducts.length})
          </button>
        </div>
      </div>

      {currentView === 'providers' && (
        <div className="providers-view">
          <h3>🏪 Pedidos de {user.organizationName} por Proveedor</h3>
          
          {Object.keys(groupedOrders).length === 0 ? (
            <div className="empty-state">
              <p>📦 No hay pedidos pendientes</p>
              <p>Todos los pedidos de {user.organizationName} han sido procesados</p>
            </div>
          ) : (
            <div className="providers-grid">
              {Object.entries(groupedOrders).map(([provider, items]) => (
                <div key={provider} className="provider-card">
                  <div className="provider-header">
                    <h4>🏪 {provider}</h4>
                    <span className="item-count">{items.length} productos</span>
                  </div>
                  
                  <div className="provider-items">
                    {items.map((item, index) => (
                      <div key={`${item.orderId}-${item.productId}-${index}`} className="provider-item">
                        <div className="item-info">
                          <h5>{item.productName}</h5>
                          <p><strong>Cantidad:</strong> {item.quantity} {item.unit}</p>
                          <p><strong>Restaurante:</strong> {item.restaurantName}</p>
                          <p><strong>Fecha:</strong> {formatDate(item.orderDate)}</p>
                          {item.isUrgent && <span className="urgent-badge">🚨 URGENTE</span>}
                        </div>
                        
                        <div className="item-actions">
                          <div className="status-info">
                            <span className="status-icon">{getStatusIcon(item.status)}</span>
                            <span className="status-text">{getStatusText(item.status)}</span>
                          </div>
                          
                          {(!item.status || item.status === 'pending') && (
                            <div className="action-buttons">
                              <button 
                                onClick={() => updateItemStatus(item.orderId, item.productId, 'found')}
                                className="action-btn found-btn"
                              >
                                ✅ Surtido
                              </button>
                              <button 
                                onClick={() => updateItemStatus(item.orderId, item.productId, 'not_found')}
                                className="action-btn not-found-btn"
                              >
                                ❌ No encontrado
                              </button>
                              <button 
                                onClick={() => handleSubstitution(item.orderId, item.productId)}
                                className="action-btn substitute-btn"
                              >
                                🔄 Sustituir
                              </button>
                            </div>
                          )}
                          
                          {item.status === 'substituted' && item.substitution && (
                            <div className="substitution-info">
                              <p><strong>Sustituido por:</strong> {item.substitution}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {currentView === 'urgent' && (
        <div className="urgent-view">
          <h3>🚨 Pedidos Urgentes - {user.organizationName}</h3>
          
          {urgentOrders.length === 0 ? (
            <div className="empty-state">
              <p>✅ No hay pedidos urgentes</p>
              <p>Todos los pedidos urgentes de {user.organizationName} han sido procesados</p>
            </div>
          ) : (
            <div className="urgent-orders">
              {urgentOrders.map(order => (
                <div key={order.id} className="urgent-order-card">
                  <div className="urgent-header">
                    <h4>🚨 {order.restaurantName}</h4>
                    <span className="urgent-date">{formatDate(order.createdAt)}</span>
                  </div>
                  
                  <div className="urgent-items">
                    {order.items.map((item, index) => (
                      <div key={`${item.productId}-${index}`} className="urgent-item">
                        <div className="item-summary">
                          <strong>{item.productName}</strong> - {item.quantity} {item.unit}
                          {item.selectedProvider && <span> (📍 {item.selectedProvider})</span>}
                        </div>
                        
                        <div className="urgent-actions">
                          {(!item.status || item.status === 'pending') && (
                            <>
                              <button 
                                onClick={() => updateItemStatus(order.id, item.productId, 'found')}
                                className="urgent-btn found"
                                title="Surtido"
                              >
                                ✅
                              </button>
                              <button 
                                onClick={() => updateItemStatus(order.id, item.productId, 'not_found')}
                                className="urgent-btn not-found"
                                title="No encontrado"
                              >
                                ❌
                              </button>
                              <button 
                                onClick={() => handleSubstitution(order.id, item.productId)}
                                className="urgent-btn substitute"
                                title="Sustituir"
                              >
                                🔄
                              </button>
                            </>
                          )}
                          {item.status && (
                            <span className="urgent-status">
                              {getStatusIcon(item.status)} {getStatusText(item.status)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {currentView === 'pending' && (
        <div className="pending-view">
          <h3>⏳ Productos Sin Proveedor - {user.organizationName}</h3>
          
          {pendingProducts.length === 0 ? (
            <div className="empty-state">
              <p>✅ Todos los productos tienen proveedor asignado</p>
              <p>No hay productos de {user.organizationName} pendientes de asignación</p>
            </div>
          ) : (
            <div className="pending-products">
              {pendingProducts.map((item, index) => (
                <div key={`${item.orderId}-${item.productId}-${index}`} className="pending-item">
                  <div className="pending-info">
                    <h4>{item.productName}</h4>
                    <p><strong>Cantidad:</strong> {item.quantity} {item.unit}</p>
                    <p><strong>Restaurante:</strong> {item.restaurantName}</p>
                    <p><strong>Categoría:</strong> {item.category}</p>
                    <p><strong>Fecha:</strong> {formatDate(item.orderDate)}</p>
                    {item.isUrgent && <span className="urgent-badge">🚨 URGENTE</span>}
                  </div>
                  
                  <div className="provider-assignment">
                    <label>Asignar proveedor:</label>
                    <select 
                      onChange={(e) => {
                        if (e.target.value) {
                          assignProvider(item.orderId, item.productId, e.target.value);
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="">Seleccionar proveedor</option>
                      <option value="Walmart">🏪 Walmart</option>
                      <option value="Sam's Club">🏪 Sam's Club</option>
                      <option value="Restaurant Depot">🏪 Restaurant Depot</option>
                      <option value="Mercado Local">🏪 Mercado Local</option>
                      <option value="Proveedor A">🏪 Proveedor A</option>
                      <option value="Proveedor B">🏪 Proveedor B</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SupplierDashboard;