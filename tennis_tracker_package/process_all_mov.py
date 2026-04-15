import cv2
import numpy as np
import json
import os
import glob

class TennisBallTracker:
    def __init__(self):
        # 存储轨迹坐标
        self.ball_trajectory = []
        # 存储历史位置，用于过滤静止物体
        self.history_positions = []
        # 最大历史位置数量
        self.max_history = 3
        # 存储上一帧的球位置
        self.prev_ball_position = None
    
    def detect_tennis_ball(self, frame):
        # 转换为HSV颜色空间
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        
        # 基于像素分析结果定义网球的颜色范围
        # HSV范围：H[30, 37], S[57, 122], V[230, 255]
        lower_yellow = np.array([30, 57, 230])
        upper_yellow = np.array([37, 122, 255])
        
        # 创建掩码
        mask = cv2.inRange(hsv, lower_yellow, upper_yellow)
        
        # 形态学操作
        kernel = np.ones((3, 3), np.uint8)
        mask = cv2.erode(mask, kernel, iterations=1)
        mask = cv2.dilate(mask, kernel, iterations=2)
        
        # 查找轮廓
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        ball_position = None
        best_contour = None
        best_score = 0
        
        for contour in contours:
            # 计算轮廓面积
            area = cv2.contourArea(contour)
            
            # 过滤掉太小或太大的轮廓（网球大小范围）
            if 10 < area < 500:
                # 计算轮廓的边界框
                x, y, w, h = cv2.boundingRect(contour)
                center_x, center_y = x + w//2, y + h//2
                
                # 计算宽高比（接近1，因为网球是圆形）
                aspect_ratio = w / float(h)
                if 0.5 < aspect_ratio < 1.5:
                    # 计算轮廓的圆形度
                    perimeter = cv2.arcLength(contour, True)
                    if perimeter > 0:
                        circularity = 4 * np.pi * area / (perimeter * perimeter)
                        
                        # 计算距离上一帧球位置的距离
                        distance_from_prev = float('inf')
                        if self.prev_ball_position is not None:
                            distance_from_prev = np.sqrt((center_x - self.prev_ball_position[0])**2 + 
                                                       (center_y - self.prev_ball_position[1])**2)
                        
                        # 计算综合得分
                        # 重点关注圆形度和距离
                        score = 0.6 * circularity + 0.4 * (1 - min(distance_from_prev, 200) / 200)
                        
                        # 选择得分最高的轮廓
                        if score > best_score:
                            best_score = score
                            best_contour = contour
                            ball_position = (center_x, center_y)
        
        # 如果找到合适的轮廓
        if ball_position is not None:
            # 检查是否是静止物体
            if self.is_moving(ball_position):
                # 更新历史位置
                self.history_positions.append(ball_position)
                if len(self.history_positions) > self.max_history:
                    self.history_positions.pop(0)
                # 更新上一帧球位置
                self.prev_ball_position = ball_position
            else:
                # 静止物体，不视为网球
                ball_position = None
        
        return ball_position
    
    def is_moving(self, position):
        """检查物体是否在移动"""
        if len(self.history_positions) < 2:
            return True  # 历史数据不足，视为移动
        
        # 计算与历史位置的平均距离
        total_distance = 0
        for prev_pos in self.history_positions:
            distance = np.sqrt((position[0] - prev_pos[0])**2 + (position[1] - prev_pos[1])**2)
            total_distance += distance
        
        average_distance = total_distance / len(self.history_positions)
        
        # 如果平均距离大于阈值，视为移动
        return average_distance > 1
    
    def process_video(self, input_video_path, output_video_path):
        # 重置轨迹
        self.ball_trajectory = []
        self.history_positions = []
        self.prev_ball_position = None
        
        # 打开视频文件
        cap = cv2.VideoCapture(input_video_path)
        
        # 获取视频信息
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        print(f"Processing video: {os.path.basename(input_video_path)}")
        print(f"Video resolution: {width}x{height}")
        print(f"Total frames: {total_frames}")
        
        # 创建视频写入器
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_video_path, fourcc, fps, (width, height))
        
        frame_count = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_count += 1
            
            # 检测网球
            ball_position = self.detect_tennis_ball(frame)
            
            # 记录轨迹坐标
            if ball_position is not None:
                self.ball_trajectory.append((frame_count, ball_position[0], ball_position[1]))
                
                # 绘制当前位置
                cv2.circle(frame, ball_position, 12, (0, 0, 255), -1)
                cv2.putText(frame, f"({ball_position[0]}, {ball_position[1]})", 
                            (ball_position[0] + 20, ball_position[1] - 20), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 2)
                
                # 绘制轨迹
                if len(self.ball_trajectory) > 1:
                    # 只绘制当前帧与前一帧之间的轨迹
                    prev_frame, prev_x, prev_y = self.ball_trajectory[-2]
                    curr_frame, curr_x, curr_y = self.ball_trajectory[-1]
                    if curr_frame == prev_frame + 1:  # 只绘制连续帧的轨迹
                        cv2.line(frame, (prev_x, prev_y), (curr_x, curr_y), (0, 0, 255), 3)
            
            # 在左上角显示帧号
            cv2.putText(frame, f"Frame: {frame_count}", 
                        (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
            
            # 写入输出视频
            out.write(frame)
            
            # 每100帧打印一次进度
            if frame_count % 100 == 0:
                progress_percent = (frame_count / total_frames) * 100
                print(f"Progress: {frame_count}/{total_frames} ({progress_percent:.2f}%)")
        
        # 释放资源
        cap.release()
        out.release()
        
        # 保存轨迹坐标
        coords_file = output_video_path.replace('.mp4', '_coords.txt')
        with open(coords_file, 'w') as f:
            for frame_num, x, y in self.ball_trajectory:
                f.write(f"{frame_num},{x},{y}\n")
        print(f"Trajectory coordinates saved to: {coords_file}")
        
        print(f"\nProcessing completed!")
        print(f"Output video saved to: {output_video_path}")
        print("=" * 80)

if __name__ == "__main__":
    # 视频输入目录
    input_dir = "../VideoInput"
    # 输出目录
    output_dir = "./output_mov_videos"
    
    # 确保输出目录存在
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # 获取所有MOV格式的视频
    mov_videos = glob.glob(os.path.join(input_dir, "*.MOV"))
    
    print(f"Found {len(mov_videos)} MOV videos to process:")
    for video in mov_videos:
        print(f"- {os.path.basename(video)}")
    print("=" * 80)
    
    # 创建跟踪器实例
    tracker = TennisBallTracker()
    
    # 处理每个视频
    for video_path in mov_videos:
        # 生成输出文件名
        video_name = os.path.basename(video_path)
        output_name = video_name.replace('.MOV', '_output.mp4')
        output_path = os.path.join(output_dir, output_name)
        
        # 处理视频
        tracker.process_video(video_path, output_path)
    
    print("All videos processed successfully!")
    print(f"Results saved to: {output_dir}")
