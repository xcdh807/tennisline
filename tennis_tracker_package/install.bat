@echo off
echo ====================================
echo Tennis Ball Tracker - 快速开始
echo ====================================
echo.

echo [1/2] 安装依赖...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo 依赖安装失败！
    pause
    exit /b 1
)

echo.
echo [2/2] 依赖安装完成！
echo.
echo ====================================
echo 使用说明：
echo 1. 将视频文件放入 VideoInput 文件夹
echo 2. 运行 run.bat 开始处理
echo 3. 结果将保存在 output_mov_videos 文件夹
echo ====================================
echo.
pause
