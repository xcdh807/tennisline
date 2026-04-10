import { Video, BarChart3, Target, History } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { NavLink } from 'react-router-dom';

interface NavItemProps {
  to: string;
  icon: any;
  label: string;
}

export function NavItem({ to, icon: Icon, label }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center justify-center py-2 px-4 transition-all duration-200",
          isActive 
            ? "text-primary bg-surface-bright/20 rounded-lg" 
            : "text-on-surface-variant hover:bg-white/5"
        )
      }
    >
      <Icon className="w-6 h-6" />
      <span className="font-body text-[10px] uppercase tracking-widest font-semibold mt-1">{label}</span>
    </NavLink>
  );
}

export function BottomNavBar() {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center pb-safe pt-2 px-4 bg-surface/80 backdrop-blur-2xl shadow-[0_-10px_30px_rgba(0,15,33,0.5)] md:hidden">
      <NavItem to="/record" icon={Video} label="拍摄" />
      <NavItem to="/dashboard" icon={BarChart3} label="统计" />
      <NavItem to="/training" icon={Target} label="训练" />
      <NavItem to="/history" icon={History} label="历史" />
    </nav>
  );
}
