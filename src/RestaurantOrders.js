import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { getOrganizationId } from './utils';
import './RestaurantOrders.css';

function RestaurantOrders({ user, onBack, initialView = 'create', initialUrgent = false }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]); // ✅ Nuevo estado
  const [orders, setOrders] = useState([]);
  const [currentView, setCurrentView] = useState(initialView);
  const [loading, setLoading] = useState(true);
  const [orderItems, setOrderItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isUrgent, setIsUrgent] = useState(initialUrgent);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCurrentView(initialView);
    setIsUrgent(initialUrgent);
  }, [initialView, initialUrgent]);

  useEffect(() => {
    loadProducts();
    loadOrders();
  }, []);

  useEffect(() => {
    const uniqueCategories = ['Todas', ...new Set(products.map(p => p.category).filter(Boolean))];
    setCategories(uniqueCategories);
  }, [products]);

  const loadProducts = async () => {
    try {
      const orgId = getOrganizationId(user);
      if (!orgId) {
        console.error('Usuario sin organizationId válido en loadProducts:', user);
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, 'products'),
        where('organizationId', '==', orgId),
        where('active', '==', true)
      );
      const querySnapshot = await getDocs(q);
      const productsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(productsData);
    } catch (error) {
      console.error('Error al cargar productos:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      const orgId = getOrganizationId(user);
      if (!orgId) {
        console.error('Usuario sin organizationId válido en loadOrders:', user);
        return;
      }

      const q = query(
        collection(db, 'orders'),
        where('restaurantId', '==', user.uid),
        where('organizationId', '==', orgId)
      );
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

  // ... (rest of the component remains unchanged)

  return (
    <div className="restaurant-orders">
      {/* ... (rest of header and layout) */}

      {currentView === 'create' && (
        <div className="filters-section">
          {/* ... (search bar) */}

          <div className="category-filter">
            <select 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.length > 0 && categories.map(category => (
                <option key={category} value={category === 'Todas' ? '' : category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          {/* ... (rest of urgent toggle and other UI) */}
        </div>
      )}

      {/* ... (rest of component code) */}
    </div>
  );
}

export default RestaurantOrders;
