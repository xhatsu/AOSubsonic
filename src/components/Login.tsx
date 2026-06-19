import { useState } from 'react';
import { useAuthStore } from '../store/auth.store';

export const Login = () => {
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const setConfig = useAuthStore((state) => state.setConfig);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (serverUrl && username && password) {
      // Remove trailing slash if exists
      const cleanUrl = serverUrl.replace(/\/$/, '');
      setConfig({
        serverUrl: cleanUrl,
        username,
        password,
      });
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-zinc-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-zinc-900 rounded-2xl shadow-xl border border-zinc-800">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">OSClient</h2>
          <p className="text-zinc-400 mt-2">Sign in to your Subsonic server</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="server" className="block text-sm font-medium text-zinc-300">Server URL</label>
              <input
                id="server"
                type="url"
                required
                className="w-full px-3 py-2 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-primary focus:border-primary sm:text-sm text-white"
                placeholder="https://music.example.com"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-zinc-300">Username</label>
              <input
                id="username"
                type="text"
                required
                className="w-full px-3 py-2 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-primary focus:border-primary sm:text-sm text-white"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300">Password</label>
              <input
                id="password"
                type="password"
                required
                className="w-full px-3 py-2 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg focus:ring-primary focus:border-primary sm:text-sm text-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-purple-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-zinc-900 transition-colors"
          >
            Connect
          </button>
        </form>
      </div>
    </div>
  );
};
