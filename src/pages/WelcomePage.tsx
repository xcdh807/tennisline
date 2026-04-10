import { Smartphone, MessageSquare, Mail, Zap, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useState } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';

export function WelcomePage() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async () => {
    setError('');
    setSuccessMsg('');
    if (!email || !password) {
      setError('请输入邮箱和密码');
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        navigate('/dashboard');
      } else {
        await signUp(email, password);
        navigate('/onboarding');
      }
    } catch (err: any) {
      setError(err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-surface overflow-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-transparent z-10" />
        <img
          alt="Professional tennis player"
          className="w-full h-full object-cover grayscale-[20%] brightness-[0.7]"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCJB6-VG1uexR3ugXS3ft1eHPSeXnHN4yVf9yaP2lDfVFtCCQuIfswOg0I9DWZvnXk4MKM4ujxUQGQ_aDeTNAfoaqMxvaDRFBPbjK9emswotU3OmzN9Xoh-zizcBhpqs62U8Jyu18VOW8x58VF65TnDte6RwqdOSTIWQRhdhqlD8tdBXf34x25D8K7sxD9cqgmVVr1jvXzBwHk30aMcdI8Uqx0bDZy-JS4zJSvdluwS48fYJ8SwU4WcpMgYm3MQ-dxUQfYf4oAPxyM"
          referrerPolicy="no-referrer"
        />
      </div>

      <header className="relative z-20 flex items-center justify-between px-6 py-6">
        <span className="text-2xl font-headline font-bold tracking-tighter text-primary">TennisLine</span>
        <button className="text-on-surface-variant font-body text-sm tracking-widest hover:text-primary transition-colors">帮助</button>
      </header>

      <main className="relative z-20 flex-grow flex flex-col items-center justify-end px-6 pb-20">
        <div className="w-full max-w-md space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-surface-variant/60 backdrop-blur-xl border border-outline-variant/15">
              <Zap className="w-3 h-3 text-primary fill-primary" />
              <span className="text-primary font-body text-[10px] uppercase font-bold tracking-[0.2em]">AI Powered Analysis</span>
            </div>
            <h1 className="font-headline text-6xl md:text-7xl font-bold tracking-tighter leading-none text-white">
              口袋里的<br/>
              <span className="text-transparent bg-clip-text kinetic-gradient">鹰眼</span>
            </h1>
            <p className="text-on-surface-variant text-lg max-w-[80%] leading-relaxed font-light">
              专业级网球轨迹追踪与数据分析，让每一分都有迹可循。
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col gap-4 w-full"
          >
            {error && (
              <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="bg-primary/10 border border-primary/20 text-primary px-4 py-3 rounded-lg text-sm">
                {successMsg}
              </div>
            )}

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱地址"
              className="w-full h-14 px-4 rounded-lg bg-surface-container-highest/40 backdrop-blur-xl border border-outline-variant/20 text-on-surface placeholder:text-outline/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码（至少6位）"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="w-full h-14 px-4 pr-12 rounded-lg bg-surface-container-highest/40 backdrop-blur-xl border border-outline-variant/20 text-on-surface placeholder:text-outline/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="kinetic-gradient text-on-primary h-14 rounded-lg font-body font-bold tracking-wider flex items-center justify-center gap-3 hover:opacity-90 active:scale-95 transition-all duration-150 shadow-[0_10px_30px_rgba(161,254,0,0.2)] disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Smartphone className="w-5 h-5" />
                  {isLogin ? '登录' : '注册'}
                </>
              )}
            </button>
            <button
              onClick={() => { setIsLogin(!isLogin); setError(''); setSuccessMsg(''); }}
              className="bg-surface-container-highest/40 backdrop-blur-xl border border-outline-variant/20 text-on-surface h-14 rounded-lg font-body font-bold tracking-wider flex items-center justify-center gap-3 hover:bg-surface-container-highest/60 active:scale-95 transition-all duration-150"
            >
              {isLogin ? '没有账号？注册' : '已有账号？登录'}
            </button>
          </motion.div>

          <div className="flex flex-col items-center gap-6 pt-4">
            <div className="flex items-center gap-4 w-full">
              <div className="h-[1px] flex-1 bg-outline-variant/20" />
              <span className="text-on-surface-variant font-body text-[10px] uppercase tracking-widest">其他登录方式</span>
              <div className="h-[1px] flex-1 bg-outline-variant/20" />
            </div>
            <div className="flex gap-8">
              <button className="w-12 h-12 rounded-full border border-outline-variant/20 flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/40 transition-all">
                <MessageSquare className="w-6 h-6" />
              </button>
              <button className="w-12 h-12 rounded-full border border-outline-variant/20 flex items-center justify-center text-on-surface-variant hover:text-primary hover:border-primary/40 transition-all">
                <Mail className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-20 px-6 pb-8 text-center">
        <p className="text-[10px] text-on-surface-variant/60 font-body tracking-tight">
          登录即代表您同意 <span className="text-on-surface-variant underline underline-offset-2">服务协议</span> 与 <span className="text-on-surface-variant underline underline-offset-2">隐私政策</span>
        </p>
      </footer>
    </div>
  );
}
