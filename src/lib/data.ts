import { collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot, getDocFromServer, setDoc, where, limit } from 'firebase/firestore';
import { db, auth } from './firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
// testConnection(); // Removed to save reads

export type OrderStatus = 'new' | 'confirmed' | 'shipped' | 'delivered' | 'returned';

export interface Order {
  id: string;
  date: string;
  customerName: string;
  phone: string;
  wilaya: string;
  commune: string;
  address?: string;
  deliveryMethod: string;
  offer: string;
  flavor?: string;
  status: OrderStatus;
  totalPrice: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  variantName?: string;
  variantOptions?: string[];
  offer2Price?: number;
  offer4Price?: number;
  colors?: string[];
  sizes?: string[];
  features?: string[];
  isSecretPackaging?: boolean;
  media: string[];
  date: string;
}

export const getProducts = async (limitCount?: number): Promise<Product[]> => {
  const path = 'products';
  try {
    let q = query(collection(db, path), orderBy('date', 'desc'));
    if (limitCount) {
      q = query(q, limit(limitCount));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const getFirstProduct = async (): Promise<Product | null> => {
  const path = 'products';
  try {
    const q = query(collection(db, path), orderBy('date', 'desc'), limit(1));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Product;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return null;
  }
};

export const getProduct = async (id: string): Promise<Product | null> => {
  const path = `products/${id}`;
  try {
    const docRef = doc(db, 'products', id);
    const productDoc = await getDoc(docRef);
    if (productDoc.exists()) {
      return { id: productDoc.id, ...productDoc.data() } as Product;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const deleteProduct = async (id: string) => {
  const path = `products/${id}`;
  try {
    await deleteDoc(doc(db, 'products', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const updateProduct = async (id: string, data: Partial<Product>) => {
  const path = `products/${id}`;
  try {
    await updateDoc(doc(db, 'products', id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const getOrders = async (): Promise<Order[]> => {
  const path = 'orders';
  try {
    const q = query(collection(db, path), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const subscribeToOrders = (callback: (orders: Order[]) => void, limitCount: number = 200) => {
  const path = 'orders';
  const q = query(collection(db, path), orderBy('date', 'desc'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    callback(orders);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

export const saveOrder = async (order: Omit<Order, 'id' | 'date' | 'status'>) => {
  const path = 'orders';
  try {
    const newOrder = {
      ...order,
      date: new Date().toISOString(),
      status: 'new'
    };
    const docRef = await addDoc(collection(db, path), newOrder);
    return { id: docRef.id, ...newOrder };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const updateOrderStatus = async (id: string, status: OrderStatus) => {
  const path = `orders/${id}`;
  try {
    await updateDoc(doc(db, 'orders', id), { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export interface Helper {
  id: string;
  email: string;
  password?: string;
}

export const getHelpers = async (): Promise<Helper[]> => {
  const path = 'helpers';
  try {
    const snapshot = await getDocs(collection(db, 'helpers'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Helper));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const subscribeToHelpers = (callback: (helpers: Helper[]) => void) => {
  const path = 'helpers';
  return onSnapshot(collection(db, 'helpers'), (snapshot) => {
    callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Helper)));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};

export const addHelper = async (helper: Omit<Helper, 'id'>) => {
  const path = 'helpers';
  try {
    const docRef = await addDoc(collection(db, path), helper);
    return { id: docRef.id, ...helper };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const deleteHelper = async (id: string) => {
  const path = `helpers/${id}`;
  try {
    await deleteDoc(doc(db, 'helpers', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const findHelperByEmail = async (email: string): Promise<Helper | null> => {
  const path = 'helpers';
  try {
    const q = query(collection(db, path), where('email', '==', email.toLowerCase().trim()));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Helper;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return null;
  }
};

export interface AppSettings {
  logoUrl?: string; // Can be a URL or Base64 string
  storeName?: string;
}

export const getAppSettings = async (): Promise<AppSettings> => {
  const path = 'settings/app';
  try {
    const docRef = doc(db, 'settings', 'app');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as AppSettings;
    }
    return {};
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return {};
  }
};

export const updateAppSettings = async (settings: Partial<AppSettings>) => {
  const path = 'settings/app';
  try {
    const docRef = doc(db, 'settings', 'app');
    await setDoc(docRef, settings, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const subscribeToAppSettings = (callback: (settings: AppSettings) => void) => {
  const path = 'settings/app';
  const docRef = doc(db, 'settings', 'app');
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data() as AppSettings);
    } else {
      callback({});
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};
