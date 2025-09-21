"""Test if dependencies work after NumPy fix"""

import sys
import json

def test_dependencies():
    """Test each dependency carefully"""
    
    results = {}
    
    print("="*60)
    print("TESTING DEPENDENCIES AFTER NUMPY FIX")
    print("="*60)
    
    # 1. Test NumPy
    print("\n1. Testing NumPy...")
    try:
        import numpy as np
        print(f"✅ NumPy {np.__version__} imported")
        
        # Test basic operations
        arr = np.array([1, 2, 3])
        mean = np.mean(arr)
        print(f"✅ Basic operations work: mean of {arr} = {mean}")
        results['numpy'] = {'status': 'OK', 'version': np.__version__}
        
    except Exception as e:
        print(f"❌ NumPy error: {e}")
        results['numpy'] = {'status': 'ERROR', 'error': str(e)}
    
    # 2. Test OpenCV
    print("\n2. Testing OpenCV...")
    try:
        import cv2
        print(f"✅ OpenCV {cv2.__version__} imported")
        
        # Test basic operation
        img = np.zeros((100, 100, 3), dtype=np.uint8)
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        print(f"✅ Basic operations work: created {gray.shape} grayscale image")
        results['opencv'] = {'status': 'OK', 'version': cv2.__version__}
        
    except Exception as e:
        print(f"❌ OpenCV error: {e}")
        results['opencv'] = {'status': 'ERROR', 'error': str(e)}
    
    # 3. Test MediaPipe
    print("\n3. Testing MediaPipe...")
    try:
        import mediapipe as mp
        print(f"✅ MediaPipe {mp.__version__} imported")
        
        # Test pose creation
        mp_pose = mp.solutions.pose
        pose = mp_pose.Pose(static_image_mode=True)
        print("✅ Pose detector created successfully")
        pose.close()
        results['mediapipe'] = {'status': 'OK', 'version': mp.__version__}
        
    except Exception as e:
        print(f"❌ MediaPipe error: {e}")
        results['mediapipe'] = {'status': 'ERROR', 'error': str(e)}
    
    # 4. Test TensorFlow
    print("\n4. Testing TensorFlow...")
    try:
        # Set TF logging to ERROR only
        import os
        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
        
        import tensorflow as tf
        print(f"✅ TensorFlow {tf.__version__} imported")
        
        # Test basic operation
        tensor = tf.constant([1, 2, 3])
        print(f"✅ Basic operations work: created tensor with shape {tensor.shape}")
        results['tensorflow'] = {'status': 'OK', 'version': tf.__version__}
        
    except Exception as e:
        print(f"❌ TensorFlow error: {e}")
        results['tensorflow'] = {'status': 'ERROR', 'error': str(e)}
    
    # 5. Test scikit-learn
    print("\n5. Testing scikit-learn...")
    try:
        import sklearn
        from sklearn.preprocessing import StandardScaler
        print(f"✅ Scikit-learn {sklearn.__version__} imported")
        
        # Test basic operation
        scaler = StandardScaler()
        data = np.array([[1, 2], [3, 4], [5, 6]])
        scaled = scaler.fit_transform(data)
        print(f"✅ Basic operations work: scaled data shape {scaled.shape}")
        results['sklearn'] = {'status': 'OK', 'version': sklearn.__version__}
        
    except Exception as e:
        print(f"❌ Scikit-learn error: {e}")
        results['sklearn'] = {'status': 'ERROR', 'error': str(e)}
    
    # 6. Test Pandas
    print("\n6. Testing Pandas...")
    try:
        import pandas as pd
        print(f"✅ Pandas {pd.__version__} imported")
        
        # Test basic operation
        df = pd.DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]})
        print(f"✅ Basic operations work: created DataFrame with shape {df.shape}")
        results['pandas'] = {'status': 'OK', 'version': pd.__version__}
        
    except Exception as e:
        print(f"❌ Pandas error: {e}")
        results['pandas'] = {'status': 'ERROR', 'error': str(e)}
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    working = sum(1 for r in results.values() if r['status'] == 'OK')
    total = len(results)
    
    print(f"\nWorking: {working}/{total}")
    
    for lib, info in results.items():
        if info['status'] == 'OK':
            print(f"✅ {lib}: v{info['version']}")
        else:
            print(f"❌ {lib}: {info.get('error', 'Unknown error')}")
    
    # Save results
    with open('dependency_test_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    return results


def test_integrated_functionality():
    """Test if libraries work together"""
    
    print("\n" + "="*60)
    print("TESTING INTEGRATED FUNCTIONALITY")
    print("="*60)
    
    # Test MediaPipe + OpenCV + NumPy
    print("\n1. Testing MediaPipe + OpenCV + NumPy integration...")
    try:
        import cv2
        import numpy as np
        import mediapipe as mp
        
        # Create test image
        img = np.ones((480, 640, 3), dtype=np.uint8) * 255
        
        # Process with MediaPipe
        mp_pose = mp.solutions.pose
        pose = mp_pose.Pose(static_image_mode=True)
        
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = pose.process(img_rgb)
        
        pose.close()
        
        print("✅ MediaPipe + OpenCV + NumPy work together!")
        
    except Exception as e:
        print(f"❌ Integration error: {e}")
    
    # Test TensorFlow + NumPy
    print("\n2. Testing TensorFlow + NumPy integration...")
    try:
        import tensorflow as tf
        import numpy as np
        
        # Create simple model
        model = tf.keras.Sequential([
            tf.keras.layers.Dense(10, input_shape=(5,)),
            tf.keras.layers.Dense(1)
        ])
        
        # Test with numpy data
        x = np.random.randn(10, 5).astype(np.float32)
        y = model(x)
        
        print(f"✅ TensorFlow + NumPy work together! Output shape: {y.shape}")
        
    except Exception as e:
        print(f"❌ Integration error: {e}")


if __name__ == "__main__":
    results = test_dependencies()
    test_integrated_functionality()
    
    print("\n✅ Testing complete! Check dependency_test_results.json for details.")

