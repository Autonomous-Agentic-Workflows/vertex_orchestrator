import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  addDoc,
  deleteDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import { User } from 'firebase/auth';

// --- User Metadata ---

export const saveUserMetadata = async (user: User) => {
  if (!user) return;
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      theme: 'dark',
      globalSettings: {}
    });
  } else {
    await updateDoc(userRef, {
      lastLogin: serverTimestamp(),
      displayName: user.displayName,
    });
  }
};

export const getUserMetadata = async (uid: string) => {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? userSnap.data() : null;
};

// --- Sessions ---

export interface SessionData {
  id?: string;
  userId: string;
  title: string;
  activeTab: string;
  notebookState: string;
  lastActive?: any;
  createdAt?: any;
}

export const saveSession = async (session: SessionData) => {
  if (session.id) {
    const sessionRef = doc(db, 'sessions', session.id);
    await updateDoc(sessionRef, {
      ...session,
      lastActive: serverTimestamp()
    });
    return session.id;
  } else {
    const sessionsCol = collection(db, 'sessions');
    const docRef = await addDoc(sessionsCol, {
      ...session,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp()
    });
    return docRef.id;
  }
};

export const getUserSessions = async (userId: string) => {
  const sessionsCol = collection(db, 'sessions');
  const q = query(sessionsCol, where('userId', '==', userId), orderBy('lastActive', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SessionData));
};

export const deleteSession = async (sessionId: string) => {
  const sessionRef = doc(db, 'sessions', sessionId);
  await deleteDoc(sessionRef);
};

// --- Workflows ---

export interface WorkflowData {
  id?: string;
  userId: string;
  name: string;
  config: Record<string, any>;
  createdAt?: any;
  updatedAt?: any;
}

export const saveWorkflow = async (workflow: WorkflowData) => {
  if (workflow.id) {
    const wfRef = doc(db, 'workflows', workflow.id);
    await updateDoc(wfRef, {
      ...workflow,
      updatedAt: serverTimestamp()
    });
    return workflow.id;
  } else {
    const wfCol = collection(db, 'workflows');
    const docRef = await addDoc(wfCol, {
      ...workflow,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  }
};

export const getUserWorkflows = async (userId: string) => {
  const wfCol = collection(db, 'workflows');
  const q = query(wfCol, where('userId', '==', userId), orderBy('updatedAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WorkflowData));
};

export const deleteWorkflow = async (workflowId: string) => {
  const wfRef = doc(db, 'workflows', workflowId);
  await deleteDoc(wfRef);
};
