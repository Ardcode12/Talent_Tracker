import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../constants/Theme';
import {
  getMessages,
  sendMessage,
  deleteMessage,
  markConversationRead,
} from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ChatScreen({ route, navigation }) {
  const { conversationId, otherUser } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const flatListRef = useRef(null);

  useEffect(() => {
    loadCurrentUser();
    loadMessages();
    markAsRead();
  }, []);

  const loadCurrentUser = async () => {
    const userData = await AsyncStorage.getItem('userData');
    if (userData) {
      const user = JSON.parse(userData);
      setCurrentUserId(user.id);
    }
  };

  const loadMessages = async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      
      const response = await getMessages(conversationId, pageNum);
      
      if (response.messages) {
        if (append) {
          setMessages(prev => [...response.messages, ...prev]);
        } else {
          setMessages(response.messages);
        }
        setHasMore(response.has_more);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const markAsRead = async () => {
    try {
      await markConversationRead(conversationId);
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    
    setSending(true);
    const messageText = inputText.trim();
    setInputText('');
    
    try {
            const newMessage = await sendMessage(conversationId, messageText);
      setMessages(prev => [...prev, newMessage]);
      
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
      setInputText(messageText); // Restore message if failed
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessage(messageId);
              setMessages(prev => prev.filter(msg => msg.id !== messageId));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete message');
            }
          }
        }
      ]
    );
  };

  const loadMoreMessages = () => {
    if (!loading && hasMore && page > 0) {
      loadMessages(page + 1, true);
    }
  };

  const formatMessageTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item, index }) => {
    const isOwnMessage = item.sender_id === currentUserId;
    const showAvatar = !isOwnMessage && (
      index === messages.length - 1 || 
      messages[index + 1]?.sender_id !== item.sender_id
    );

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
      ]}>
        {showAvatar && !isOwnMessage && (
          <Image
            source={{ uri: item.sender.profile_photo || 'https://via.placeholder.com/40' }}
            style={styles.messageAvatar}
          />
        )}
        
        <TouchableOpacity
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
            !showAvatar && !isOwnMessage && styles.messageBubbleWithoutAvatar
          ]}
          onLongPress={() => isOwnMessage && handleDeleteMessage(item.id)}
          activeOpacity={0.8}
        >
          <Text style={[
            styles.messageText,
            isOwnMessage ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {item.text}
          </Text>
          
          <View style={styles.messageFooter}>
            <Text style={[
              styles.messageTime,
              isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime
            ]}>
              {formatMessageTime(item.created_at)}
            </Text>
            
            {isOwnMessage && (
              <Ionicons 
                name={item.is_read ? "checkmark-done" : "checkmark"} 
                size={16} 
                color={item.is_read ? Theme.colors.primary : "#999"} 
                style={styles.readReceipt}
              />
            )}
          </View>
          
          {item.edited_at && (
            <Text style={styles.editedLabel}>(edited)</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading && page === 1) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Theme.colors.text} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.headerContent}
          onPress={() => navigation.navigate('Profile', { userId: otherUser.id })}
        >
          <Image
            source={{ uri: otherUser.profile_photo || 'https://via.placeholder.com/40' }}
            style={styles.headerAvatar}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{otherUser.name}</Text>
            <Text style={styles.headerStatus}>
              {otherUser.is_online ? 'Online' : 'Offline'} • {otherUser.role} • {otherUser.sport}
            </Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.moreButton}>
          <Ionicons name="ellipsis-vertical" size={24} color={Theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        inverted={false}
        contentContainerStyle={styles.messagesList}
        onEndReached={loadMoreMessages}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadMessages(1, false);
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start the conversation!</Text>
          </View>
        }
      />

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor={Theme.colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxHeight={100}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 15,
    paddingBottom: 15,
    backgroundColor: 'rgba(20, 27, 45, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 5,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: Theme.colors.text,
  },
  headerStatus: {
    fontSize: 13,
    color: Theme.colors.textSecondary,
  },
  moreButton: {
    padding: 5,
  },
  messagesList: {
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  messageContainer: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  ownMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  messageBubbleWithoutAvatar: {
    marginLeft: 44,
  },
  ownMessageBubble: {
    backgroundColor: Theme.colors.primary,
  },
  otherMessageBubble: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: Theme.colors.text,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 12,
  },
  ownMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherMessageTime: {
    color: Theme.colors.textSecondary,
  },
  readReceipt: {
    marginLeft: 4,
  },
  editedLabel: {
    fontSize: 11,
    fontStyle: 'italic',
    color: Theme.colors.textSecondary,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: Theme.colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: 'rgba(20, 27, 45, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  textInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: Theme.colors.text,
    maxHeight: 100,
    marginRight: 10,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
