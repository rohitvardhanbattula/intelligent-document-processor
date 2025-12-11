
import React from 'react';
import { User, UserRole } from '../types';
import { ICONS } from '../constants';
import { logout, hasPermission } from '../services/authService';

interface HeaderProps {
  user: User | null;
  navigateTo: (view: 'dashboard' | 'training' | 'settings' | 'test-bench') => void;
}

const Header: React.FC<HeaderProps> = ({ user, navigateTo }) => {
  if (!user) return null;

  const canConfigure = hasPermission(user, 'settings');

  return (
    <header className="bg-blue-900 shadow-md p-4 flex justify-between items-center sticky top-0 z-20 border-b border-blue-800">
      <div className="flex items-center space-x-3 cursor-pointer" onClick={() => navigateTo('dashboard')}>
        <div className="text-white opacity-90">{ICONS.brain}</div>
        <div className="flex flex-col">
            <h1 className="text-xl font-bold text-white tracking-tight">Answerthink</h1>
            <span className="text-[10px] text-blue-200 uppercase tracking-wider font-semibold">Intelligent Document Processor</span>
        </div>
      </div>
      <div className="flex items-center space-x-6">
        <button
          onClick={() => navigateTo('dashboard')}
          className="text-sm font-medium text-blue-100 hover:text-white transition-colors"
        >
          Dashboard
        </button>
        {canConfigure && (
            <>
                <button
                    onClick={() => navigateTo('training')}
                    className="text-sm font-medium text-blue-100 hover:text-white transition-colors"
                >
                    Training Center
                </button>
                <button
                    onClick={() => navigateTo('test-bench')}
                    className="text-sm font-medium text-blue-100 hover:text-white transition-colors flex items-center gap-1"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    Dev Tools
                </button>
            </>
        )}
        <div className="flex items-center space-x-4 border-l border-blue-700 pl-4">
             {canConfigure && (
                <button
                    onClick={() => navigateTo('settings')}
                    className="text-blue-300 hover:text-white transition-colors p-1"
                    title="System Settings"
                >
                    {ICONS.settings}
                </button>
             )}

             <div className="flex items-center space-x-3 group relative cursor-pointer py-2">
                <div className="text-right hidden md:block">
                    <p className="text-sm font-bold text-white leading-none">{user.name}</p>
                    <p className="text-[10px] text-blue-300 uppercase font-semibold mt-1">{user.role}</p>
                </div>
                <img 
                    src={user.avatar} 
                    alt="User" 
                    className="w-8 h-8 rounded-full border border-blue-400" 
                />
                
                {/* Dropdown for Logout */}
                {/* Increased top padding (pt-4) to create a larger invisible bridge for the mouse */}
                <div className="absolute right-0 top-full pt-4 w-40 hidden group-hover:block z-50">
                    <div className="bg-white dark:bg-slate-800 rounded shadow-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 md:hidden">
                             <p className="text-sm font-bold text-slate-800 dark:text-white">{user.name}</p>
                             <p className="text-xs text-slate-500">{user.role}</p>
                        </div>
                        <button 
                            onClick={logout}
                            className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors flex items-center"
                        >
                            <span className="mr-2">Log Out</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                        </button>
                    </div>
                </div>
             </div>
        </div>
      </div>
    </header>
  );
};

export default Header;