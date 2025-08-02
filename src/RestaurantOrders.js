import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import './RestaurantOrders.css';

function RestaurantOrders({ user, onBack, initialView = 'create', initialUrgent = false }) {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [currentView, setCurrentView] = useState(initialView);
  const [loading, setLoading] = useState(true);
  const [orderItems, setOrderItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isUrgent, setIsUrgent] = useState(initialUrgent);
  const [submitting, setSubmitting] = useState(false);

  // Detectar cambios en parámetros iniciales
  useEffect(() => {
    setCurrentView(initialView);
    setIsUrgent(initialUrgent);
  }, [initialView, initialUrgent]);

  const categories = [
    'Todas', 'Carnes', 'Verduras', 'Lácteos', 'Abarrotes', 'Bebidas', 
    'Limpieza', 'Panadería', 'Congelados', 'Condimentos', 'Otros'
  ];

  const providers = [
    'Walmart', 'Sam\'s Club', 'Restaurant Depot', 
    'Mercado Local', 'Proveedor A', 'Proveedor B'
  ];

  useEffect(() => {
    loadProducts();
    loadOrders();
  }, []);

  const loadProducts = async () => {
    try {
      // Solo productos de la misma organización y activos
      const q = query(
        collection(db, 'products'), 
        where('organizationId', '==', user.organizationId),
        where('active', '==', true)
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

  const loadOrders = async () => {
    try {
      // Solo pedidos del restaurante específico de la misma organización
      const q = query(
        collection(db, 'orders'), 
        where('restaurantId', '==', user.uid),
        where('organizationId', '==', user.organizationId)
      );
      const querySnapshot = await getDocs(q);
      
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      ordersData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(ordersData);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
    }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === '' || selectedCategory === 'Todas' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToOrder = (product) => {
    const existingItem = orderItems.find(item => item.productId === product.id);
    
    if (existingItem) {
      setOrderItems(orderItems.map(item =>
        item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setOrderItems([...orderItems, {
        productId: product.id,
        productName: product.name,
        unit: product.unit,
        category: product.category,
        defaultProvider: product.defaultProvider || '',
        selectedProvider: product.defaultProvider || '',
        quantity: 1
      }]);
    }
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      setOrderItems(orderItems.filter(item => item.productId !== productId));
    } else {
      setOrderItems(orderItems.map(item =>
        item.productId === productId 
          ? { ...item, quantity: quantity }
          : item
      ));
    }
  };

  const updateProvider = (productId, provider) => {
    setOrderItems(orderItems.map(item =>
      item.productId === productId 
        ? { ...item, selectedProvider: provider }
        : item
    ));
  };

  const submitOrder = async () => {
    if (orderItems.length === 0) {
      alert('Agrega al menos un producto al pedido');
      return;
    }

    setSubmitting(true);
    try {
      const orderData = {
        restaurantId: user.uid,
        restaurantName: user.restaurant,
        organizationId: user.organizationId, // Asociar con organización
        organizationName: user.organizationName,
        items: orderItems,
        isUrgent: isUrgent,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        weekOf: getWeekOf(),
        totalItems: orderItems.reduce((sum, item) => sum + item.quantity, 0)
      };

      await addDoc(collection(db, 'orders'), orderData);
      
      setOrderItems([]);
      setIsUrgent(false);
      setSearchTerm('');
      setSelectedCategory('');
      
      alert(isUrgent ? '🚨 Pedido urgente enviado exitosamente' : '✅ Pedido semanal enviado exitosamente');
      
      await loadOrders();
      setCurrentView('history');
      
    } catch (error) {
      console.error('Error al enviar pedido:', error);
      alert('❌ Error al enviar el pedido. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const getWeekOf = () => {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    return startOfWeek.toISOString().split('T')[0];
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusText = (status) => {
    const statusMap = {
      'pending': '⏳ Pendiente',
      'processing': '🔄 En proceso',
      'completed': '✅ Completado',
      'delivered': '🚚 Entregado'
    };
    return statusMap[status] || status;
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
    <div className="restaurant-orders">
      <div className="ro-header">
        <button onClick={onBack} className="back-button">← Volver</button>
        <h2>🍴 {user.restaurant} - {user.organizationName}</h2>
        <div className="view-toggle">
          <button 
            className={currentView === 'create' ? 'active' : ''}
            onClick={() => setCurrentView('create')}
          >
            {isUrgent && currentView === 'create' ? 'Pedido Urgente 🚨' : 'Crear Pedido'}
          </button>
          <button 
            className={currentView === 'history' ? 'active' : ''}
            onClick={() => setCurrentView('history')}
          >
            Historial ({orders.length})
          </button>
        </div>
      </div>

      {currentView === 'create' ? (
        <div className="create-order-view">
          <div className="filters-section">
            <div className="search-bar">
              <input
                type="text"
                placeholder="🔍 Buscar productos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="category-filter">
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map(category => (
                  <option key={category} value={category === 'Todas' ? '' : category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="urgent-toggle">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                />
                Pedido Urgente 🚨
              </label>
            </div>
          </div>

          <div className="order-content">
            <div className="products-section">
              <h3>📦 Catálogo de Productos ({filteredProducts.length})</h3>
              
              {filteredProducts.length === 0 ? (
                <div className="empty-products">
                  <p>No se encontraron productos</p>
                  <p>Contacta a tu administrador para agregar productos al catálogo</p>
                </div>
              ) : (
                <div className="products-list">
                  {filteredProducts.map(product => (
                    <div key={product.id} className="product-item">
                      <div className="product-info">
                        <h4>{product.name}</h4>
                        <p><strong>Unidad:</strong> {product.unit}</p>
                        <p><strong>Categoría:</strong> {product.category}</p>
                        {product.defaultProvider && (
                          <p><strong>Proveedor sugerido:</strong> {product.defaultProvider}</p>
                        )}
                      </div>
                      <button 
                        onClick={() => addToOrder(product)}
                        className="add-button"
                      >
                        + Agregar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="order-section">
              <h3>🛒 Mi Pedido ({orderItems.length} productos)</h3>
              
              {orderItems.length === 0 ? (
                <div className="empty-order">
                  <p>🛒 Carrito vacío</p>
                  <p>Selecciona productos del catálogo</p>
                </div>
              ) : (
                <>
                  <div className="order-summary">
                    <p><strong>Total de productos:</strong> {orderItems.reduce((sum, item) => sum + item.quantity, 0)}</p>
                    <p><strong>Tipo:</strong> {isUrgent ? '🚨 Urgente' : '📋 Semanal'}</p>
                    <p><strong>Organización:</strong> {user.organizationName}</p>
                  </div>

                  <div className="order-items">
                    {orderItems.map(item => (
                      <div key={item.productId} className="order-item">
                        <div className="item-details">
                          <h4>{item.productName}</h4>
                          <p>{item.category} • {item.unit}</p>
                        </div>
                        
                        <div className="quantity-controls">
                          <button 
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          >
                            -
                          </button>
                          <span>{item.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          >
                            +
                          </button>
                        </div>

                        <div className="provider-select">
                          <select
                            value={item.selectedProvider}
                            onChange={(e) => updateProvider(item.productId, e.target.value)}
                          >
                            <option value="">Sin proveedor específico</option>
                            {providers.map(provider => (
                              <option key={provider} value={provider}>{provider}</option>
                            ))}
                          </select>
                        </div>

                        <button 
                          onClick={() => updateQuantity(item.productId, 0)}
                          className="remove-button"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="order-actions">
                    <button 
                      onClick={submitOrder}
                      disabled={submitting}
                      className="submit-order-button"
                    >
                      {submitting ? 'Enviando...' : (isUrgent ? '🚨 Enviar Pedido Urgente' : '📋 Enviar Pedido Semanal')}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="history-view">
          <h3>📋 Historial de Pedidos</h3>
          {orders.length === 0 ? (
            <div className="empty-history">
              <p>📝 No tienes pedidos realizados</p>
              <button 
                onClick={() => setCurrentView('create')} 
                className="create-first-order-button"
              >
                Crear primer pedido
              </button>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map(order => (
                <div key={order.id} className={`order-card ${order.isUrgent ? 'urgent' : ''}`}>
                  <div className="order-header">
                    <h4>
                      {order.isUrgent ? '🚨 Pedido Urgente' : '📋 Pedido Semanal'}
                    </h4>
                    <span className="order-date">
                      {formatDate(order.createdAt)}
                    </span>
                  </div>
                  
                  <div className="order-summary">
                    <p><strong>Estado:</strong> {getStatusText(order.status)}</p>
                    <p><strong>Productos:</strong> {order.items.length}</p>
                    <p><strong>Cantidad total:</strong> {order.totalItems}</p>
                    {order.weekOf && <p><strong>Semana del:</strong> {order.weekOf}</p>}
                  </div>

                  <div className="order-items-summary">
                    <strong>Productos solicitados:</strong>
                    <ul>
                      {order.items.slice(0, 3).map(item => (
                        <li key={item.productId}>
                          {item.productName} ({item.quantity} {item.unit})
                        </li>
                      ))}
                      {order.items.length > 3 && (
                        <li>... y {order.items.length - 3} productos más</li>
                      )}
                    </ul>
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

export default RestaurantOrders;