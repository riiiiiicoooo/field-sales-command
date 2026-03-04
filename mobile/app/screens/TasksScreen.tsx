import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  SectionList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { RootState } from '../store/store';
import { fetchTasks, completeTask } from '../store/taskSlice';

interface Task {
  id: string;
  title: string;
  customerName: string;
  dueTime: string;
  status: 'pending' | 'in_progress' | 'completed';
  isOverdue: boolean;
}

interface TaskSection {
  title: string;
  data: Task[];
}

interface NavigationProp {
  navigate: (screen: string, params?: any) => void;
}

export default function TasksScreen({ navigation }: { navigation: NavigationProp }) {
  const dispatch = useDispatch();
  const [completionNotes, setCompletionNotes] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { todaysTasks, tomorrowsTasks, completedCount, loading } = useSelector(
    (state: RootState) => state.task
  );

  useEffect(() => {
    dispatch(fetchTasks());
  }, [dispatch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchTasks());
    setRefreshing(false);
  }, [dispatch]);

  const handleCompleteTask = async () => {
    if (!selectedTask) return;

    setCompleting(true);
    try {
      await dispatch(
        completeTask({
          taskId: selectedTask.id,
          notes: completionNotes,
        })
      );

      setShowCompletionModal(false);
      setCompletionNotes('');
      setSelectedTask(null);
      Alert.alert('Success', 'Task completed successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to complete task');
    } finally {
      setCompleting(false);
    }
  };

  const handleTaskSwipe = (task: Task) => {
    setSelectedTask(task);
    setCompletionNotes('');
    setShowCompletionModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10b981';
      case 'in_progress':
        return '#3b82f6';
      case 'pending':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const sections: TaskSection[] = [];

  // Today's section
  if (todaysTasks.length > 0) {
    sections.push({
      title: `TODAY (${completedCount}/${todaysTasks.length} completed)`,
      data: todaysTasks,
    });
  }

  // Tomorrow's section
  if (tomorrowsTasks.length > 0) {
    sections.push({
      title: 'TOMORROW',
      data: tomorrowsTasks,
    });
  }

  const renderTaskItem = ({ item }: { item: Task }) => (
    <TouchableOpacity
      onPress={() => handleTaskSwipe(item)}
      style={{
        marginHorizontal: 16,
        marginVertical: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: item.isOverdue ? '#fef2f2' : '#fff',
        borderLeftWidth: 4,
        borderLeftColor: item.isOverdue ? '#ef4444' : getStatusColor(item.status),
        borderRadius: 8,
        borderWidth: 1,
        borderColor: item.isOverdue ? '#fecaca' : '#e5e7eb',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '600',
              color: '#000',
              textDecorationLine: item.status === 'completed' ? 'line-through' : 'none',
            }}
          >
            {item.title}
          </Text>
          <Text style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{item.customerName}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Ionicons name="time-outline" size={12} color="#999" />
            <Text style={{ fontSize: 12, color: '#999', marginLeft: 4 }}>
              {item.dueTime}
              {item.isOverdue && ' (OVERDUE)'}
            </Text>
          </View>
        </View>
        <View
          style={{
            backgroundColor: getStatusColor(item.status),
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 4,
            marginLeft: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 11 }}>
            {item.status === 'completed' ? '✓' : item.status === 'in_progress' ? '◉' : '○'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: TaskSection }) => (
    <View style={{ backgroundColor: '#f3f4f6', paddingHorizontal: 16, paddingVertical: 10 }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: '#000', letterSpacing: 0.5 }}>
        {section.title}
      </Text>
    </View>
  );

  if (loading && todaysTasks.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#1e40af" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ backgroundColor: '#1e40af', paddingHorizontal: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff' }}>Tasks</Text>
      </View>

      {sections.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="checkmark-done-circle" size={48} color="#ccc" />
          <Text style={{ fontSize: 16, color: '#666', marginTop: 12 }}>No tasks scheduled</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => item.id + index}
          renderItem={renderTaskItem}
          renderSectionHeader={renderSectionHeader}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingVertical: 12 }}
        />
      )}

      {/* Completion Modal */}
      <Modal
        visible={showCompletionModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCompletionModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#000' }}>Complete Task</Text>
              <TouchableOpacity onPress={() => setShowCompletionModal(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            {selectedTask && (
              <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 4 }}>
                  {selectedTask.title}
                </Text>
                <Text style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>{selectedTask.customerName}</Text>

                <Text style={{ fontSize: 13, fontWeight: '600', color: '#000', marginBottom: 8 }}>
                  Add Notes (Optional)
                </Text>
                <TextInput
                  placeholder="Task notes, issues encountered, follow-up needed..."
                  value={completionNotes}
                  onChangeText={setCompletionNotes}
                  style={{
                    borderWidth: 1,
                    borderColor: '#e5e7eb',
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    fontSize: 14,
                    minHeight: 100,
                    textAlignVertical: 'top',
                  }}
                  multiline={true}
                  editable={!completing}
                />
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 32 }}>
              <TouchableOpacity
                onPress={() => setShowCompletionModal(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                }}
                disabled={completing}
              >
                <Text style={{ textAlign: 'center', color: '#666', fontWeight: '600', fontSize: 16 }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCompleteTask}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: '#10b981',
                }}
                disabled={completing}
              >
                {completing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ textAlign: 'center', color: '#fff', fontWeight: '600', fontSize: 16 }}>
                    Complete
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
