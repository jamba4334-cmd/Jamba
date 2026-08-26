import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export function CartProvider({ children }) {
    const [cart, setCart] = useState([]);

    useEffect(() => {
        const savedCart = JSON.parse(localStorage.getItem('jambaCart')) || [];
        setCart(savedCart);
    }, []);

    const addToCart = (product, size) => {
        const newCart = [...cart];
        const existingIndex = newCart.findIndex(item => item.id === product.id && item.size === size);

        if (existingIndex > -1) {
            newCart[existingIndex].quantity += 1;
        } else {
            newCart.push({ ...product, size, quantity: 1 });
        }
        
        setCart(newCart);
        localStorage.setItem('jambaCart', JSON.stringify(newCart));
    };

    const removeFromCart = (id, size) => {
        const newCart = cart.filter(item => !(item.id === id && item.size === size));
        setCart(newCart);
        localStorage.setItem('jambaCart', JSON.stringify(newCart));
    };

    const updateQuantity = (id, size, delta) => {
        const newCart = cart.map(item => {
            if (item.id === id && item.size === size) {
                return { ...item, quantity: Math.max(1, item.quantity + delta) };
            }
            return item;
        });
        setCart(newCart);
        localStorage.setItem('jambaCart', JSON.stringify(newCart));
    };

    const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

    return (
        <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, cartCount }}>
            {children}
        </CartContext.Provider>
    );
}

export const useCart = () => useContext(CartContext);