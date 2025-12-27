// frontend/App.js - COMPLETE REPLACEMENT

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';
import { getUnreadCount } from './services/api';

// Import your screens
import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import ExploreScreen from './screens/Assestment';
import ConnectionsScreen from './screens/ConnectionsScreen';
import ProfileScreen from './screens/ProfileScreen';
import ProfileCompletionScreen from './screens/ProfileCompletionScreen';
import CreatePostScreen from './screens/CreatePostScreen';
import CoachDashboard from './screens/CoachDashboard';
import CoachAssessments from './screens/CoachAssessments';
import CoachProfileScreen from './screens/CoachProfileScreen';
import MessagesScreen from './screens/MessagesScreen';
import ChatScreen from './screens/ChatScreen';
import NewMessageScreen from './screens/NewMessageScreen';
import NotificationsScreen from './screens/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ============================================
// OWN PROFILE SCREEN - NEVER RECEIVES userId PARAM
// ============================================
function OwnProfileScreen() {
  // This component explicitly passes NO userId, forcing ProfileScreen to show current user
  return <ProfileScreen />;
}

function OwnCoachProfileScreen() {
  return <CoachProfileScreen />;
}

// ============================================
// ATHLETE TAB NAVIGATOR
// ============================================
function AthleteTabNavigator() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    checkUnreadMessages();
    const interval = setInterval(checkUnreadMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkUnreadMessages = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Error checking unread messages:', error);
    }
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Assessments':
              iconName = focused ? 'compass' : 'compass-outline';
              break;
            case 'Messages':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Connections':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'alert-circle-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopWidth: 0,
          elevation: 0,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarBadge: route.name === 'Messages' && unreadCount > 0 ? unreadCount : undefined,
        tabBarBadgeStyle: {
          backgroundColor: '#FF3B30',
          color: '#fff',
          fontSize: 10,
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Assessments" component={ExploreScreen} />
      <Tab.Screen 
        name="Messages" 
        component={MessagesScreen}
        listeners={{ tabPress: () => checkUnreadMessages() }}
      />
      <Tab.Screen name="Connections" component={ConnectionsScreen} />
      {/* USE OwnProfileScreen - NOT ProfileScreen */}
      <Tab.Screen name="Profile" component={OwnProfileScreen} />
    </Tab.Navigator>
  );
}

// ============================================
// COACH TAB NAVIGATOR
// ============================================
function CoachTabNavigator() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    checkUnreadMessages();
    const interval = setInterval(checkUnreadMessages, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkUnreadMessages = async () => {
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Error checking unread messages:', error);
    }
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'speedometer' : 'speedometer-outline';
              break;
            case 'Athletes':
              iconName = focused ? 'people' : 'people-outline';
              break;
            case 'Assessments':
              iconName = focused ? 'analytics' : 'analytics-outline';
              break;
            case 'Messages':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'alert-circle-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2c3e50',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopWidth: 0,
          elevation: 0,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarBadge: route.name === 'Messages' && unreadCount > 0 ? unreadCount : undefined,
        tabBarBadgeStyle: {
          backgroundColor: '#FF3B30',
          color: '#fff',
          fontSize: 10,
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={CoachDashboard} />
      <Tab.Screen name="Athletes" component={ConnectionsScreen} />
      <Tab.Screen name="Assessments" component={CoachAssessments} />
      <Tab.Screen 
        name="Messages" 
        component={MessagesScreen}
        listeners={{ tabPress: () => checkUnreadMessages() }}
      />
      {/* USE OwnCoachProfileScreen - NOT CoachProfileScreen */}
      <Tab.Screen name="Profile" component={OwnCoachProfileScreen} />
    </Tab.Navigator>
  );
}

// ============================================
// MAIN APP
// ============================================
export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState('Login');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const [isLoggedIn, profileCompleted, token, userData, userRole] = await Promise.all([
        AsyncStorage.getItem('isLoggedIn'),
        AsyncStorage.getItem('profileCompleted'),
        AsyncStorage.getItem('authToken'),
        AsyncStorage.getItem('userData'),
        AsyncStorage.getItem('userRole')
      ]);
      
      if (isLoggedIn === 'true' && token !== null) {
        let user = null;
        if (userData) {
          try {
            user = JSON.parse(userData);
          } catch (e) {
            console.error('Error parsing user data:', e);
          }
        }

        const isProfileComplete = user && !!(
          user.age && 
          user.location && 
          (user.profile_image || user.profile_photo)
        );

        const userSpecificFlag = user ? await AsyncStorage.getItem(`profile_completed_${user.id}`) : null;

        if (isProfileComplete || profileCompleted === 'true' || userSpecificFlag === 'true' || profileCompleted === 'skipped') {
          const role = userRole || (user && user.role);
          if (role === 'coach') {
            setInitialRoute('CoachMain');
          } else {
            setInitialRoute('Main');
          }
        } else {
          setInitialRoute('ProfileCompletion');
        }
      } else {
        setInitialRoute('Login');
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      setInitialRoute('Login');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={initialRoute}
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#000' },
          }}
        >
          {/* AUTH */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="ProfileCompletion" component={ProfileCompletionScreen} />
          
          {/* MAIN TABS */}
          <Stack.Screen name="Main" component={AthleteTabNavigator} />
          <Stack.Screen name="CoachMain" component={CoachTabNavigator} />
          
          {/* ============================================ */}
          {/* OTHER USER PROFILE - THIS IS THE KEY SCREEN */}
          {/* ============================================ */}
          <Stack.Screen 
            name="UserProfile" 
            component={ProfileScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: '#1a1a1a' },
              headerTintColor: '#fff',
              title: 'Profile',
            }}
          />
          
          {/* OTHER SCREENS */}
          <Stack.Screen name="CreatePost" component={CreatePostScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="ChatScreen" component={ChatScreen} />
          <Stack.Screen name="NewMessage" component={NewMessageScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
          <Stack.Screen name="ConnectionRequests" component={ConnectionsScreen} />
          <Stack.Screen name="AthleteDetail" component={ProfileScreen} />
          <Stack.Screen name="Rankings" component={ExploreScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}