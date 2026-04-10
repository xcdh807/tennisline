import { Video, VideoOff, Upload, Zap, Square, Circle, SwitchCamera, X, ChevronLeft, Play, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { BottomNavBar } from '@/src/components/BottomNavBar';
import { AnalysisHUD } from '@/src/components/AnalysisHUD';
import { cn } from '@/src/lib/utils';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { createMatchSession, uploadVideo } from '@/src/lib/api';
import { useVideoAnalysis } from '@/src/lib/useVideoAnalysis';

type PageMode = 'idle' | 'camera' | 'video';

export function LiveRecordingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [mode, setMode] = useState<PageMode>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const uploadVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analysis engine - active when recording or playing uploaded video
  const analysisActive = (mode === 'camera' && isRecording) || (mode === 'video' && isPlaying);
  const { data: analysisData, reset: resetAnalysis } = useVideoAnalysis(analysisActive, 1800);

  // Timer
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => setTimer(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // ---- Camera ----
  const startCamera = useCallback(async (facing: 'user' | 'environment' = facingMode) => {
    setCameraError('');
    if (!window.isSecureContext) {
      setCameraError('摄像头需要 HTTPS 安全连接。请使用 https:// 或 localhost 访问本应用');
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('当前浏览器不支持摄像头功能，请使用最新版 Chrome / Safari 访问');
      return;
    }
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setMode('camera');
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('摄像头权限被拒绝，请在浏览器设置中允许访问摄像头');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('未检测到摄像头设备');
      } else if (err.name === 'NotReadableError') {
        setCameraError('摄像头被其他应用占用，请关闭后重试');
      } else if (err.name === 'OverconstrainedError') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          streamRef.current = stream;
          if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
          setMode('camera');
          return;
        } catch { setCameraError('摄像头参数不兼容'); }
      } else {
        setCameraError(`无法访问摄像头: ${err.message || '未知错误'}`);
      }
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsRecording(false);
    setTimer(0);
    resetAnalysis();
    setMode('idle');
  }, [resetAnalysis]);

  const toggleRecording = useCallback(() => {
    if (!streamRef.current) return;
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      resetAnalysis();
      chunksRef.current = [];
      let recorder: MediaRecorder;
      try { recorder = new MediaRecorder(streamRef.current, { mimeType: 'video/webm;codecs=vp9,opus' }); }
      catch { recorder = new MediaRecorder(streamRef.current); }
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const finalAnalysis = analysisData;
        if (chunksRef.current.length > 0 && user) {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          try {
            setSavedMsg('正在保存视频...');
            const filename = `recording-${Date.now()}.webm`;
            const url = await uploadVideo(user.id, blob, filename);
            await createMatchSession({
              user_id: user.id, type: 'training',
              title: `录制 ${new Date().toLocaleString('zh-CN')}`,
              accuracy: finalAnalysis.accuracy || undefined,
              shots: finalAnalysis.rally || 0,
              speed: finalAnalysis.speed || undefined,
              rpm: finalAnalysis.rpm || undefined,
              location: '实时录制', video_url: url,
            });
            setSavedMsg('视频及分析数据已保存');
            setTimeout(() => setSavedMsg(''), 3000);
          } catch {
            setSavedMsg('保存失败，正在下载到本地...');
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `tennisline-${Date.now()}.webm`; a.click();
            URL.revokeObjectURL(url);
            setTimeout(() => setSavedMsg(''), 3000);
          }
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setTimer(0);
      setIsRecording(true);
    }
  }, [isRecording, user, resetAnalysis, analysisData]);

  const switchCamera = useCallback(async () => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);
    if (mode === 'camera') await startCamera(newFacing);
  }, [facingMode, mode, startCamera]);

  // ---- Video Upload ----
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('video/')) { setCameraError('请选择视频文件'); return; }
    setCameraError('');
    stopCamera();
    resetAnalysis();
    setVideoUrl(URL.createObjectURL(file));
    setMode('video');
    setIsPlaying(false);
  };

  const closeVideo = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setIsPlaying(false);
    resetAnalysis();
    setMode('idle');
  };

  const togglePlayPause = () => {
    if (!uploadVideoRef.current) return;
    if (uploadVideoRef.current.paused) {
      uploadVideoRef.current.play();
      setIsPlaying(true);
    } else {
      uploadVideoRef.current.pause();
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, []);

  // ========== IDLE MODE ==========
  if (mode === 'idle') {
    return (
      <div className="bg-surface text-on-surface font-body h-screen w-full relative flex flex-col">
        <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-primary-container fill-primary-container" />
            <span className="font-headline font-bold tracking-tight text-xl text-white italic">TennisLine</span>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-6 pt-20 pb-32 gap-8">
          <div className="text-center space-y-3 mb-4">
            <div className="w-20 h-20 rounded-full bg-surface-container-highest mx-auto flex items-center justify-center mb-6">
              <Video className="w-10 h-10 text-primary/60" />
            </div>
            <h2 className="font-headline text-3xl font-bold text-white tracking-tight">开始拍摄</h2>
            <p className="text-on-surface-variant text-sm max-w-xs mx-auto">
              开启摄像头实时录制网球比赛，或上传已有视频进行 AI 轨迹分析
            </p>
          </div>
          {cameraError && (
            <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm max-w-sm text-center">{cameraError}</div>
          )}
          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button onClick={() => startCamera()} className="kinetic-gradient text-on-primary h-14 rounded-xl font-bold text-base tracking-wide flex items-center justify-center gap-3 hover:opacity-90 active:scale-95 transition-all shadow-[0_10px_30px_rgba(161,254,0,0.2)]">
              <Video className="w-5 h-5" /> 开启摄像头
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="bg-surface-container-high border border-outline-variant/20 text-on-surface h-14 rounded-xl font-bold text-base tracking-wide flex items-center justify-center gap-3 hover:bg-surface-bright active:scale-95 transition-all">
              <Upload className="w-5 h-5" /> 上传视频分析
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
        </main>
        <BottomNavBar />
      </div>
    );
  }

  // ========== VIDEO UPLOAD MODE ==========
  if (mode === 'video') {
    return (
      <div className="bg-surface text-on-surface font-body overflow-hidden h-screen w-full relative">
        <div className="fixed inset-0 z-0 bg-black flex items-center justify-center">
          <video ref={uploadVideoRef} src={videoUrl!} className="w-full h-full object-contain" playsInline onEnded={() => setIsPlaying(false)} />
        </div>

        {/* Analysis HUD overlay */}
        <AnalysisHUD data={analysisData} compact />

        {/* Top Bar */}
        <header className="fixed top-0 w-full z-50 bg-transparent backdrop-blur-xl flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-4">
            <button onClick={closeVideo} className="text-white hover:text-primary transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex flex-col">
              <span className="font-headline font-bold tracking-tight text-xl text-white italic">视频分析</span>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-on-surface-variant">
                <span className={cn("w-1.5 h-1.5 rounded-full", isPlaying ? "bg-primary animate-pulse" : "bg-outline")} />
                {isPlaying ? 'AI 分析中' : '已暂停'}
              </div>
            </div>
          </div>
        </header>

        {/* Controls */}
        <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
          <div className="flex items-center justify-center gap-8 py-6 mb-16">
            <button onClick={closeVideo} className="glass-panel w-14 h-14 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors active:scale-90">
              <X className="w-6 h-6" />
            </button>
            <button onClick={togglePlayPause} className={cn("w-20 h-20 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(161,254,0,0.3)] active:scale-90 transition-transform", isPlaying ? "bg-white/20 backdrop-blur-xl border-2 border-primary" : "kinetic-gradient")}>
              {isPlaying ? <Pause className="w-7 h-7 text-primary" /> : <Play className="w-7 h-7 fill-on-primary text-on-primary ml-1" />}
            </button>
            <button onClick={() => { closeVideo(); fileInputRef.current?.click(); }} className="glass-panel w-14 h-14 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors active:scale-90">
              <Upload className="w-6 h-6" />
            </button>
          </div>
          <BottomNavBar />
        </div>

        <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
      </div>
    );
  }

  // ========== CAMERA MODE ==========
  return (
    <div className="bg-surface text-on-surface font-body overflow-hidden h-screen w-full relative">
      <div className="fixed inset-0 z-0 bg-black">
        <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
        {/* Trajectory overlay */}
        <AnimatePresence>
          {isRecording && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 1000" preserveAspectRatio="none">
              <motion.path initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.8 }} exit={{ opacity: 0 }} transition={{ duration: 2, repeat: Infinity }} d="M 200,800 Q 500,200 800,600" fill="none" stroke="#a1fe00" strokeWidth="4" className="drop-shadow-[0_0_8px_#a1fe00]" strokeDasharray="10" />
              <motion.circle animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 1, repeat: Infinity }} cx="800" cy="600" r="8" fill="#a1fe00" />
            </svg>
          )}
        </AnimatePresence>
      </div>

      {/* Analysis HUD overlay */}
      {isRecording && <AnalysisHUD data={analysisData} />}

      {/* Top Bar */}
      <header className="fixed top-0 w-full z-50 bg-transparent backdrop-blur-xl flex justify-between items-center px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={stopCamera} className="text-primary hover:text-white transition-colors"><ChevronLeft className="w-6 h-6" /></button>
          <div className="flex flex-col">
            <span className="font-headline font-bold tracking-tight text-xl text-white italic">TennisLine</span>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-on-surface-variant">
              <span className={cn("w-1.5 h-1.5 rounded-full", isRecording ? "bg-error animate-pulse" : "bg-primary")} />
              {isRecording ? `录制中 ${formatTime(timer)}` : '预览中'}
            </div>
          </div>
        </div>
        {isRecording && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="bg-error/80 backdrop-blur px-3 py-1 rounded-lg">
            <span className="text-white text-xs font-bold">{formatTime(timer)}</span>
          </motion.div>
        )}
      </header>

      {/* Toast */}
      <AnimatePresence>
        {savedMsg && (
          <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }} className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-primary text-on-primary px-6 py-3 rounded-xl font-bold text-sm shadow-lg">{savedMsg}</motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls */}
      <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
        <div className="flex items-center justify-center gap-8 py-6 mb-16">
          <button onClick={stopCamera} className="glass-panel w-14 h-14 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors active:scale-90"><VideoOff className="w-6 h-6" /></button>
          <button onClick={toggleRecording} className={cn("w-20 h-20 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(161,254,0,0.3)] active:scale-90 transition-transform", isRecording ? "bg-error" : "kinetic-gradient")}>
            {isRecording ? <Square className="w-7 h-7 fill-white text-white" /> : <Circle className="w-7 h-7 fill-on-primary text-on-primary" />}
          </button>
          <button onClick={switchCamera} className="glass-panel w-14 h-14 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors active:scale-90"><SwitchCamera className="w-6 h-6" /></button>
        </div>
        <BottomNavBar />
      </div>

      {/* Crosshair */}
      {!isRecording && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center opacity-20 z-10">
          <div className="w-48 h-48 border border-white/40 rounded-full relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-white" />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-white" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-3 bg-white" />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 h-0.5 w-3 bg-white" />
          </div>
        </div>
      )}
    </div>
  );
}
