@echo off
echo ====================================
echo Tennis Ball Tracker - 开始处理
echo ====================================
echo.

echo 正在处理视频...
python process_all_mov.py

echo.
echo ====================================
echo 处理完成！
echo 结果保存在 output_mov_videos 文件夹
echo ====================================
echo.
pause
