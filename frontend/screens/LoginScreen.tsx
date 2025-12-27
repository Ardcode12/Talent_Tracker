import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import ApiService from "../services/api";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  SlideInRight,
  withSpring,
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { MaterialIcons as Icon } from '@expo/vector-icons';
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");

// ✅ Updated type definitions for navigation
type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  CoachMain: undefined;  // ✅ ADD THIS
  ProfileCompletion: undefined;
};

type LoginScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Login'>;

const AnimatedAuthScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();

  const [userType, setUserType] = useState("athlete");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    phone: "",
    sport: "",
    experience: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<any>({});

  // Animations
  const roleAnimation = useSharedValue(0);
  const formScale = useSharedValue(1);

  const getThemeColor = () =>
    userType === "athlete" ? "#667eea" : "#2c3e50";

  const validateForm = () => {
    const newErrors: any = {};

    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Invalid email format";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (!isLogin) {
      if (!formData.name.trim()) {
        newErrors.name = "Name is required";
      }
      if (!formData.phone.trim()) {
        newErrors.phone = "Phone number is required";
      } else if (!/^\d{10}$/.test(formData.phone)) {
        newErrors.phone = "Phone number must be 10 digits";
      }
      
      if (userType === 'athlete' && !formData.sport.trim()) {
        newErrors.sport = "Sport is required for athletes";
      }
      if (userType === 'coach' && !formData.sport.trim()) {
        newErrors.sport = "Specialization is required for coaches";
      }
      
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = "Please confirm your password";
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ✅ Check if profile is complete
  const checkProfileCompletion = (userData: any) => {
    // Check if essential profile fields are filled
    return !!(
      userData.age && 
      userData.location && 
      (userData.profile_image || userData.profile_photo)
    );
  };

  // ✅ UPDATED handleAuth function with proper profile completion check
  const handleAuth = async () => {
  if (!validateForm()) return;
  setLoading(true);

  try {
    let response;
    if (isLogin) {
      // LOGIN FLOW
      response = await ApiService.login(formData.email, formData.password);
      
      if (response && response.token) {
        // Save login data
        await AsyncStorage.setItem('authToken', response.token);
        await AsyncStorage.setItem('userData', JSON.stringify(response.user));
        await AsyncStorage.setItem('isLoggedIn', 'true');
        await AsyncStorage.setItem('userRole', response.user.role);
        
        console.log('Login successful, user role:', response.user.role);
        
        // Check if profile is complete
        const isProfileComplete = checkProfileCompletion(response.user);
        
        const profileCompletedFlag = await AsyncStorage.getItem('profileCompleted');
        const userSpecificFlag = await AsyncStorage.getItem(`profile_completed_${response.user.id}`);
        
        if (isProfileComplete || profileCompletedFlag === 'true' || userSpecificFlag === 'true') {
          await AsyncStorage.setItem('profileCompleted', 'true');
          
          // Navigate based on role
          if (response.user.role === 'coach') {
            navigation.reset({
              index: 0,
              routes: [{ name: 'CoachMain' }],
            });
          } else {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            });
          }
        } else if (profileCompletedFlag === 'skipped') {
          // Navigate based on role even if skipped
          if (response.user.role === 'coach') {
            navigation.reset({
              index: 0,
              routes: [{ name: 'CoachMain' }],
            });
          } else {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Main' }],
            });
          }
        } else {
          // Profile not completed
          navigation.reset({
            index: 0,
            routes: [{ name: 'ProfileCompletion' }],
          });
        }
      }
    } else {
      // SIGNUP FLOW
      // frontend/screens/LoginScreen.tsx
// Inside handleAuth function, update the signupData object:

// SIGNUP FLOW
const signupData = {
  email: formData.email,
  password: formData.password,
  name: formData.name,
  phone: formData.phone,
  role: userType, // 'athlete' or 'coach'
  sport: formData.sport,
  // ✅ FIX: Convert experience to integer or null
  experience: userType === 'coach' && formData.experience 
    ? parseInt(formData.experience, 10) 
    : null,
  specialization: userType === 'coach' ? formData.sport : null
};
      response = await ApiService.signup(signupData);
      
      if (response && response.token) {
        // Save signup data
        await AsyncStorage.setItem('authToken', response.token);
        await AsyncStorage.setItem('userData', JSON.stringify(response.user));
        await AsyncStorage.setItem('isLoggedIn', 'true');
        await AsyncStorage.setItem('userRole', response.user.role);
        
        console.log('Signup successful, user role:', response.user.role);
        
        // Navigate to profile completion
        navigation.reset({
          index: 0,
          routes: [{ name: 'ProfileCompletion' }],
        });
      }
    }
  } catch (error: any) {
    console.error('Auth error:', error);
    Alert.alert("Error", error.message || "Something went wrong. Try again.");
  } finally {
    setLoading(false);
  }
};



  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev: any) => ({ ...prev, [field]: "" }));
    }
  };

  // Animation styles
  const athleteStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          roleAnimation.value,
          [0, 1],
          [1, 0.9],
          Extrapolate.CLAMP
        ),
      },
    ],
    opacity: interpolate(roleAnimation.value, [0, 1], [1, 0.5]),
  }));

  const coachStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          roleAnimation.value,
          [0, 1],
          [0.9, 1],
          Extrapolate.CLAMP
        ),
      },
    ],
    opacity: interpolate(roleAnimation.value, [0, 1], [0.5, 1]),
  }));

  const switchRole = (role: "athlete" | "coach") => {
    formScale.value = withSpring(0.95, {}, () => {
      formScale.value = withSpring(1);
    });
    if (role === "coach") {
      roleAnimation.value = withSpring(1);
      setUserType("coach");
    } else {
      roleAnimation.value = withSpring(0);
      setUserType("athlete");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: getThemeColor() }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View
            entering={FadeInDown.duration(1000).springify()}
            style={styles.header}
          >
            <View style={styles.logoContainer}>
              <Icon name="sports-soccer" size={60} color="#fff" />
            </View>
            <Text style={styles.appTitle}>Talent Tracker</Text>
            <Text style={styles.appSubtitle}>Elite Training Platform</Text>
          </Animated.View>

          {/* Role selector */}
          <Animated.View
            entering={FadeInUp.delay(200).duration(1000).springify()}
            style={styles.roleSelector}
          >
            <Text style={styles.roleSelectorTitle}>I am a</Text>
            <View style={styles.roleButtons}>
              <Animated.View style={[athleteStyle]}>
                <TouchableOpacity
                  onPress={() => switchRole("athlete")}
                  style={[
                    styles.roleButton,
                    userType === "athlete" && styles.activeRoleButton,
                  ]}
                >
                  <Icon
                    name="directions-run"
                    size={30}
                    color={userType === "athlete" ? "#fff" : "#667eea"}
                  />
                  <Text
                    style={[
                      styles.roleButtonText,
                      userType === "athlete" && styles.activeRoleButtonText,
                    ]}
                  >
                    Athlete
                  </Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={[coachStyle]}>
                <TouchableOpacity
                  onPress={() => switchRole("coach")}
                  style={[
                    styles.roleButton,
                    userType === "coach" && styles.activeRoleButton,
                  ]}
                >
                  <Icon
                    name="sports"
                    size={30}
                    color={userType === "coach" ? "#fff" : "#2c3e50"}
                  />
                  <Text
                    style={[
                      styles.roleButtonText,
                      userType === "coach" && styles.activeRoleButtonText,
                    ]}
                  >
                    Coach
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>

          {/* Form */}
          <Animated.View
            entering={SlideInRight.delay(400).duration(1000).springify()}
            style={styles.formCard}
          >
            <Text style={styles.formTitle}>
              {isLogin ? "Welcome Back!" : "Join Us Today"}
            </Text>
            <Text style={styles.formSubtitle}>
              {isLogin
                ? `Sign in to your ${userType} account`
                : `Create your ${userType} account`}
            </Text>

            {/* Name field */}
            {!isLogin && (
              <>
                <View style={styles.inputContainer}>
                  <Icon
                    name="person"
                    size={20}
                    color="#666"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    value={formData.name}
                    onChangeText={(value) => updateField("name", value)}
                    placeholderTextColor="#999"
                  />
                </View>
                {errors.name && (
                  <Text style={styles.errorText}>{errors.name}</Text>
                )}
              </>
            )}

            {/* Email */}
            <View style={styles.inputContainer}>
              <Icon
                name="email"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={formData.email}
                onChangeText={(value) => updateField("email", value)}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor="#999"
              />
            </View>
            {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

            {/* Phone */}
            {!isLogin && (
              <>
                <View style={styles.inputContainer}>
                  <Icon
                    name="phone"
                    size={20}
                    color="#666"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Phone Number"
                    value={formData.phone}
                    onChangeText={(value) => updateField("phone", value)}
                    keyboardType="numeric"
                    maxLength={10}
                    placeholderTextColor="#999"
                  />
                </View>
                {errors.phone && (
                  <Text style={styles.errorText}>{errors.phone}</Text>
                )}
              </>
            )}

            {/* Sport field */}
            {!isLogin && (
              <>
                <View style={styles.inputContainer}>
                  <Icon
                    name="sports"
                    size={20}
                    color="#666"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder={
                      userType === "athlete" 
                        ? "Your Sport (e.g., Basketball, Football)" 
                        : "Specialization (e.g., Basketball Coach)"
                    }
                    value={formData.sport}
                    onChangeText={(value) => updateField("sport", value)}
                    placeholderTextColor="#999"
                  />
                </View>
                {errors.sport && (
                  <Text style={styles.errorText}>{errors.sport}</Text>
                )}
              </>
            )}

            {/* Experience field for coaches */}
            {!isLogin && userType === 'coach' && (
              <>
                <View style={styles.inputContainer}>
                  <Icon
                    name="timer"
                    size={20}
                    color="#666"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Years of Experience"
                    value={formData.experience}
                    onChangeText={(value) => updateField("experience", value)}
                    keyboardType="numeric"
                    placeholderTextColor="#999"
                  />
                </View>
                {errors.experience && (
                  <Text style={styles.errorText}>{errors.experience}</Text>
                )}
              </>
            )}

            {/* Password */}
            <View style={styles.inputContainer}>
              <Icon
                name="lock"
                size={20}
                color="#666"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={formData.password}
                onChangeText={(value) => updateField("password", value)}
                secureTextEntry={!showPassword}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Icon
                  name={showPassword ? "visibility" : "visibility-off"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            {errors.password && (
              <Text style={styles.errorText}>{errors.password}</Text>
            )}

            {/* Confirm Password if Signup */}
            {!isLogin && (
              <>
                <View style={styles.inputContainer}>
                  <Icon
                    name="lock"
                    size={20}
                    color="#666"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChangeText={(value) =>
                      updateField("confirmPassword", value)
                    }
                    secureTextEntry
                    placeholderTextColor="#999"
                  />
                </View>
                {errors.confirmPassword && (
                  <Text style={styles.errorText}>
                    {errors.confirmPassword}
                  </Text>
                )}
              </>
            )}

            {/* Forgot Password */}
            {isLogin && (
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={[styles.forgotPasswordText, { color: getThemeColor() }]}>
                  Forgot Password?
                </Text>
              </TouchableOpacity>
            )}

            {/* Submit */}
            <TouchableOpacity
              onPress={handleAuth}
              disabled={loading}
              style={[styles.submitButton, { backgroundColor: getThemeColor() }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {isLogin ? "LOGIN" : "SIGN UP"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Switch form */}
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleText}>
                {isLogin
                  ? "Don't have an account? "
                  : "Already have an account? "}
              </Text>
              <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                <Text
                  style={[styles.toggleLink, { color: getThemeColor() }]}
                >
                  {isLogin ? "Sign Up" : "Login"}
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

// Styles remain the same
const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingVertical: 40, paddingHorizontal: 20 },
  header: { alignItems: "center", marginBottom: 30 },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  appTitle: { fontSize: 36, fontWeight: "bold", color: "#fff", marginBottom: 5 },
  appSubtitle: { fontSize: 16, color: "rgba(255,255,255,0.8)" },
  roleSelector: { marginBottom: 30 },
  roleSelectorTitle: { fontSize: 18, color: "#fff", textAlign: "center", marginBottom: 15 },
  roleButtons: { flexDirection: "row", justifyContent: "center", gap: 20 },
  roleButton: {
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: "center",
    minWidth: 120,
  },
  activeRoleButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 2,
    borderColor: "#fff",
  },
  roleButtonText: { fontSize: 16, fontWeight: "600", color: "#333", marginTop: 5 },
  activeRoleButtonText: { color: "#fff" },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3, shadowRadius: 20,
    elevation: 10,
  },
  formTitle: { fontSize: 24, fontWeight: "bold", color: "#333", marginBottom: 5, textAlign: "center" },
  formSubtitle: { fontSize: 14, color: "#666", marginBottom: 25, textAlign: "center" },
  inputContainer: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f5f5f5", borderRadius: 10,
    marginBottom: 5, paddingHorizontal: 15,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, fontSize: 16, color: "#333" },
  eyeIcon: { padding: 10 },
  errorText: { color: "#ff3333", fontSize: 12, marginBottom: 10, marginLeft: 5 },
  forgotPassword: { alignSelf: "flex-end", marginBottom: 20 },
  forgotPasswordText: { fontSize: 14 },
  submitButton: {
    borderRadius: 25, height: 50, justifyContent: "center", alignItems: "center",
    marginTop: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 5, elevation: 5,
  },
  submitButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  toggleContainer: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  toggleText: { color: "#666", fontSize: 14 },
  toggleLink: { fontSize: 14, fontWeight: "bold" },
});

export default AnimatedAuthScreen;
