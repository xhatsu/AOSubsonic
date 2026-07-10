import React, { useState } from 'react';
import { FiLock, FiLoader } from 'react-icons/fi';
import { downloaderApi } from '../api/downloader';

interface DownloaderAuthProps {
  onSuccess: () => void;
}

export const DownloaderAuth: React.FC<DownloaderAuthProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      await downloaderApi.login(password);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Incorrect password');
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full p-6 bg-zinc-950">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
            <FiLock className="text-3xl text-primary" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-white text-center mb-2">Restricted Access</h2>
        <p className="text-zinc-400 text-center text-sm mb-8">
          Please enter the password to access the Downloader tools.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-zinc-950 border border-zinc-700 focus:border-primary text-white px-4 py-3 rounded-lg outline-none transition-colors"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full bg-primary hover:bg-purple-600 disabled:bg-primary/50 text-white font-bold py-3 rounded-lg transition-colors active:scale-[0.98] flex justify-center items-center"
          >
            {isLoading ? <FiLoader className="animate-spin text-xl" /> : 'Unlock Downloader'}
          </button>
        </form>
      </div>
    </div>
  );
};
