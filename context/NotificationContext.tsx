"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
    id: number;
    message: string;
    type: NotificationType;
}

interface NotificationContextType {
    showNotification: (message: string, type: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const showNotification = useCallback((message: string, type: NotificationType) => {
        const id = Date.now();
        setNotifications(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 4000);
    }, []);

    return (
        <NotificationContext.Provider value={{ showNotification }}>
            {children}
            <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 w-80">
                {notifications.map(n => (
                    <div
                        key={n.id}
                        className={`p-4 rounded-2xl border shadow-2xl animate-in slide-in-from-right duration-300 flex items-center gap-3 ${n.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                                n.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                                    n.type === 'warning' ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' :
                                        'bg-blue-500/10 border-blue-500/20 text-blue-400'
                            } backdrop-blur-xl`}
                    >
                        <div className="text-xl">
                            {n.type === 'success' ? '✅' : n.type === 'error' ? '❌' : n.type === 'warning' ? '⚠️' : 'ℹ️'}
                        </div>
                        <div className="text-xs font-bold leading-relaxed">{n.message}</div>
                        <button
                            onClick={() => setNotifications(prev => prev.filter(notif => notif.id !== n.id))}
                            className="ml-auto opacity-40 hover:opacity-100 transition"
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
}

export function useNotification() {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotification must be used within a NotificationProvider');
    return context;
}
