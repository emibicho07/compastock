import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { db } from './firebase';
import './AdminOverview.css';
import CodeManager from './CodeManager';

function AdminOverview({ user, onBack, handleNavigation }) {
  const [loading, setLoading] = useState(true);
  const [showCodeManager, setShowCodeManager] = useState(false);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalProducts: 0,
    totalUsers: 0,
    urgentOrders: 0,
    pendingOrders: 0,
    completedOrders: 0
  });
  const [chartData, setChartData] = useState([]);
  const [ordersByStatus, setOrdersByStatus] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [topProducts, setTopProducts] = useState([]);

  // 🔥 MISMA LÓGICA DE ADMIN QUE EN APP.JS
  const normalizedRole = (user?.role ?? '').toString().trim().toLowerCase();
  const canAdmin =
    normalizedRole === 'admin' ||
    normalizedRole === 'administrador' ||
    user?.roles?.admin === true ||
    user?.isAdmin === true ||
    (Array.isArray(user?.permissions) && user.permissions.includes('admin')) ||
    (Array.isArray(user?.permissions) && user.permissions.includes('inventory.manage'));

  useEffect(() => {
    loadDashboardData();
    
    // Debug para verificar
    console.log('🔍 DEBUG AdminOverview:');
    console.log('user.role (raw):', user?.role);
    console.log('normalizedRole:', normalizedRole);
    console.log('canAdmin:', canAdmin);
    console.log('showCodeManager:', showCodeManager);
    console.log('handleNavigation type:', typeof handleNavigation);
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [orders, products, users] = await Promise.all([
        loadOrders(),
        loadProducts(),
        loadUsers()
      ]);
      calculateStats(orders, products, users);
      generateChartData(orders);
      calculateOrdersByStatus(orders);
      generateRecentActivity(orders);
      calculateTopProducts(orders);
    } catch (error) {
      console.error('Error al cargar datos del dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    const q = query(
      collection(db, 'orders'),
      where('organizationId', '==', user.organizationId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  };

  const loadProducts = async () => {
    const q = query(
      collection(db, 'products'),
      where('organizationId', '==', user.organizationId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  };

  const loadUsers = async () => {
    const q = query(
      collection(db, 'users'),
      where('organizationId', '==', user.organizationId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  };

  const calculateStats = (orders, products, users) => {
    const urgentCount = orders.filter(order => order.isUrgent).length;
    const pendingCount = orders.filter(order => order.status === 'pending').length;
    const completedCount = orders.filter(order => order.status === 'completed' || order.status === 'delivered').length;

    setStats({
      totalOrders: orders.length,
      totalProducts: products.filter(p => p.active).length,
      totalUsers: users.length,
      urgentOrders: urgentCount,
      pendingOrders: pendingCount,
      completedOrders: completedCount
    });
  };

  const generateChartData = (orders) => {
    const last7Days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayOrders = orders.filter(order => {
        const orderDate = new Date(order.createdAt).toISOString().split('T')[0];
        return orderDate === dateStr;
      });

      last7Days.push({
        date: date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
        pedidos: dayOrders.length,
        urgentes: dayOrders.filter(o => o.isUrgent).length
      });
    }

    setChartData(last7Days);
  };

  const calculateOrdersByStatus = (orders) => {
    const statusCount = {
      pending: orders.filter(o => o.status === 'pending').length,
      processing: orders.filter(o => o.status === 'processing').length,
      completed: orders.filter(o => o.status === 'completed').length,
      delivered: orders.filter(o => o.status === 'delivered').length
    };

    const statusData = [
      { name: 'Pendientes', value: statusCount.pending, color: '#ff9800' },
      { name: 'En Proceso', value: statusCount.processing, color: '#2196f3' },
      { name: 'Completados', value: statusCount.completed, color: '#4caf50' },
      { name: 'Entregados', value: statusCount.delivered, color: '#8bc34a' }
    ].filter(item => item.value > 0);

    setOrdersByStatus(statusData);
  };

  const generateRecentActivity = (orders) => {
    const recentOrders = orders
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map(order => ({
        id: order.id,
        restaurant: order.restaurantName,
        type: order.isUrgent ? 'Urgente' : 'Semanal',
        items: order.totalItems || order.items?.length || 0,
        date: new Date(order.createdAt).toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        }),
        status: order.status
      }));

    setRecentActivity(recentOrders);
  };

  const calculateTopProducts = (orders) => {
    const productCount = {};
    orders.forEach(order => {
      order.items?.forEach(item => {
        if (productCount[item.productName]) {
          productCount[item.productName] += item.quantity;
        } else {
          productCount[item.productName] = item.quantity;
        }
      });
    });

    const topProducts = Object.entries(productCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, quantity]) => ({ name, quantity }));

    setTopProducts(topProducts);
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: '⏳',
      processing: '🔄',
      completed: '✅',
      delivered: '🚚'
    };
    return icons[status] || '📋';
  };

  const navigateToInventory = () => {
    console.log('🔘 Botón de inventario presionado');
    if (handleNavigation) {
      console.log('✅ Navegando a inventory-control');
      handleNavigation('inventory-control');
    } else {
      console.error('❌ handleNavigation no definido');
    }
  };

  if (showCodeManager) {
    return <CodeManager user={user} onBack={() => setShowCodeManager(false)} />;
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando vista general...</p>
      </div>
    );
  }

  return (
    <div className="admin-overview">
      <div className="ao-header">
        <button onClick={onBack} className="back-button">← Volver</button>
        <h2>📊 Vista General - {user.organizationName}</h2>
        {/* 🔥 CAMBIO PRINCIPAL: Usar canAdmin en lugar de user.role === 'admin' */}
        {canAdmin && !showCodeManager && (
          <div className="header-buttons">
            <button
              className="back-button"
              style={{ 
                marginTop: '1rem', 
                backgroundColor: '#2196F3', 
                color: '#fff',
                marginRight: '0.5rem'
              }}
              onClick={navigateToInventory}
            >
              📊 Gestionar Inventario
            </button>
            <button
              className="back-button"
              style={{ marginTop: '1rem', backgroundColor: '#4caf50', color: '#fff' }}
              onClick={() => setShowCodeManager(true)}
            >
              ➕ Administrar Códigos
            </button>
          </div>
        )}
      </div>

      {/* Resto del código igual... */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <h3>{stats.totalOrders}</h3>
            <p>Total Pedidos</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <h3>{stats.totalProducts}</h3>
            <p>Productos Activos</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>{stats.totalUsers}</h3>
            <p>Usuarios</p>
          </div>
        </div>
        
        <div className="stat-card urgent">
          <div className="stat-icon">🚨</div>
          <div className="stat-content">
            <h3>{stats.urgentOrders}</h3>
            <p>Pedidos Urgentes</p>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-container">
          <h3>📈 Actividad de Pedidos (Últimos 7 días)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="pedidos" stroke="#2196f3" strokeWidth={3} name="Total" />
              <Line type="monotone" dataKey="urgentes" stroke="#f44336" strokeWidth={2} name="Urgentes" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h3>🔥 Productos Más Solicitados</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topProducts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="quantity" fill="#4caf50" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bottom-grid">
        <div className="chart-container">
          <h3>📊 Estados de Pedidos</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={ordersByStatus}
                cx="50%"
                cy="50%"
                outerRadius={60}
                fill="#8884d8"
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {ordersByStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="activity-container">
          <h3>🕒 Actividad Reciente</h3>
          <div className="activity-list">
            {recentActivity.length === 0 ? (
              <p className="no-activity">No hay actividad reciente</p>
            ) : (
              recentActivity.map(activity => (
                <div key={activity.id} className="activity-item">
                  <div className="activity-icon">
                    {getStatusIcon(activity.status)}
                  </div>
                  <div className="activity-content">
                    <div className="activity-main">
                      <strong>{activity.restaurant}</strong>
                      <span className={`activity-type ${activity.type.toLowerCase()}`}>
                        {activity.type}
                      </span>
                    </div>
                    <div className="activity-details">
                      {activity.items} productos • {activity.date}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminOverview;