import { User, UserRole } from "../types";

const AUTH_KEY = 'idp_auth_session';

// Mock Database of Users
const MOCK_USERS: User[] = [
    {
        id: 'u1',
        email: 'user@answerthink.com',
        name: 'John Doe',
        role: UserRole.EndUser,
        avatar: 'https://ui-avatars.com/api/?name=John+Doe&background=0D8ABC&color=fff'
    },
    {
        id: 'u2',
        email: 'analyst@answerthink.com',
        name: 'Sarah Smith',
        role: UserRole.Analyst,
        avatar: 'https://ui-avatars.com/api/?name=Sarah+Smith&background=6d28d9&color=fff'
    },
    {
        id: 'u3',
        email: 'admin@answerthink.com',
        name: 'Admin User',
        role: UserRole.Admin,
        avatar: 'https://ui-avatars.com/api/?name=Admin&background=10b981&color=fff'
    }
];

export const login = async (email: string): Promise<User> => {
    // Simulating API latency
    await new Promise(resolve => setTimeout(resolve, 800));

    const user = MOCK_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    
    if (user) {
        localStorage.setItem(AUTH_KEY, JSON.stringify(user));
        return user;
    }
    
    throw new Error("Invalid credentials. Try 'user@answerthink.com' or 'analyst@answerthink.com'");
};

export const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    window.location.reload(); // Hard reset state
};

export const getCurrentUser = (): User | null => {
    try {
        const stored = localStorage.getItem(AUTH_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        return null;
    }
};

export const hasPermission = (user: User, view: 'dashboard' | 'training' | 'settings' | 'test-bench'): boolean => {
    if (user.role === UserRole.Admin) return true;
    
    if (view === 'training' || view === 'test-bench' || view === 'settings') {
        return user.role === UserRole.Analyst;
    }
    
    return true; // Dashboard/Review available to all
};
