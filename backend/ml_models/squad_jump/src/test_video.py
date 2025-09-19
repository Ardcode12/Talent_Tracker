import cv2
video_path = "D:\\sportify app\\backend\\squad jump\\videos\\benchmark\\benchmark_video.mp4"
print("Attempting to open:", video_path)
cap = cv2.VideoCapture(video_path)
if cap.isOpened():
    print("Video opened successfully!")
    cap.release()
else:
    print(f"Failed to open video: {video_path}")