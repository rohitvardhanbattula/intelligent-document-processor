
import React, { useState } from 'react';
import { login } from '../services/authService';
import { ICONS } from '../constants';
import { User } from '../types';

interface LoginViewProps {
    onLoginSuccess: (user: User) => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('admin@answerthink.com');
    const [password, setPassword] = useState('password'); // Dummy field for UX
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const user = await login(email);
            onLoginSuccess(user);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 px-4">
            <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="bg-blue-900 p-8 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white/10 text-white mb-4">
                        <div className="scale-150">{ICONS.brain}</div>
                    </div>
                    <h1 className="text-2xl font-bold text-white">Answerthink IDP</h1>
                    <p className="text-blue-200 text-sm mt-2">Intelligent Document Processing</p>
                </div>
                
                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email Address</label>
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Password</label>
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-700 dark:text-white"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-700 text-sm rounded border border-red-200">
                                {error}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2.5 rounded-md transition-all shadow-sm hover:shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex justify-center"
                        >
                            {isLoading ? (
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
                        <p className="text-xs text-center text-slate-500 mb-2">Demo Accounts (Password: any)</p>
                        <div className="flex flex-wrap gap-2 justify-center">
                            <button onClick={() => setEmail('user@answerthink.com')} className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200">End User</button>
                            <button onClick={() => setEmail('analyst@answerthink.com')} className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200">Analyst</button>
                            <button onClick={() => setEmail('admin@answerthink.com')} className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200">Admin</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginView;
