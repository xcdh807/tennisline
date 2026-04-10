import { ChevronLeft, User, Bell, Shield, Info, LogOut, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '@/src/contexts/AuthContext';

export function SettingsPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  const settingsItems = [
    { icon: User, label: '账户设置', description: '管理您的个人资料和偏好' },
    { icon: Bell, label: '通知', description: '管理您的推送通知' },
    { icon: Shield, label: '隐私与安全', description: '管理您的数据和安全设置' },
    { icon: Info, label: '关于 TennisLine', description: '版本信息和法律条款' },
  ];

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-20">
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl flex items-center px-6 py-4 border-b border-outline-variant/10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/5 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-on-surface" />
        </button>
        <h1 className="ml-4 text-xl font-headline font-bold text-white tracking-tight">设置</h1>
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-8">
        <section className="space-y-4">
          {settingsItems.map((item, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="w-full flex items-center justify-between p-4 bg-surface-container rounded-xl hover:bg-surface-container-high transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-surface-bright flex items-center justify-center text-primary">
                  <item.icon className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-white">{item.label}</p>
                  <p className="text-xs text-on-surface-variant">{item.description}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-on-surface-variant group-hover:text-primary transition-colors" />
            </motion.button>
          ))}
        </section>

        <section className="pt-8 border-t border-outline-variant/10">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-4 p-4 text-error hover:bg-error/5 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-bold">退出登录</span>
          </button>
        </section>
      </main>
    </div>
  );
}
