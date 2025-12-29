import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint,
  addDoc,
  QueryDocumentSnapshot,
  DocumentData,
  or,
} from 'firebase/firestore';
import { db, isDemoMode } from './config';

// Helper to convert Firestore timestamps to ISO strings
const convertTimestamps = (data: any): any => {
  if (!data || typeof data !== 'object') return data;
  
  if (data instanceof Timestamp) {
    return data.toDate().toISOString();
  }

  if (Array.isArray(data)) {
    return data.map(convertTimestamps);
  }

  const converted: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      converted[key] = value.toDate().toISOString();
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      converted[key] = convertTimestamps(value);
    } else {
      converted[key] = value;
    }
  }
  return converted;
};

// Firestore service that mimics Supabase query interface
export const firestore = {
  // Get a single document
  async getDoc(collectionName: string, docId: string) {
    if (isDemoMode) {
      return { data: null, error: null };
    }

    try {
      const docRef = doc(db, collectionName, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          data: { id: docSnap.id, ...convertTimestamps(docSnap.data()) },
          error: null,
        };
      }
      return { data: null, error: null };
    } catch (error: any) {
      // If offline, try to get from cache
      if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
        try {
          const { getDocFromCache } = await import('firebase/firestore');
          const docRef = doc(db, collectionName, docId);
          const cachedDoc = await getDocFromCache(docRef);
          if (cachedDoc.exists()) {
            return {
              data: { id: cachedDoc.id, ...convertTimestamps(cachedDoc.data()) },
              error: null,
            };
          }
        } catch (cacheError) {
          // No cache available
        }
      }
      return { data: null, error };
    }
  },

  // Query collection with filters
  async query(collectionName: string, constraints: QueryConstraint[] = []) {
    if (isDemoMode) {
      return { data: [], error: null };
    }

    try {
      const q = query(collection(db, collectionName), ...constraints);
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
        id: doc.id,
        ...convertTimestamps(doc.data()),
      }));
      return { data, error: null };
    } catch (error: any) {
      // If offline, try to get from cache
      if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
        try {
          const { getDocsFromCache } = await import('firebase/firestore');
          const q = query(collection(db, collectionName), ...constraints);
          const cachedSnapshot = await getDocsFromCache(q);
          const data = cachedSnapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
            id: doc.id,
            ...convertTimestamps(doc.data()),
          }));
          return { data, error: null };
        } catch (cacheError) {
          // No cache available
        }
      }
      return { data: [], error };
    }
  },

  // Insert a document
  async insert(collectionName: string, data: any, docId?: string) {
    if (isDemoMode) {
      const result = { id: `demo-${Date.now()}`, ...data };
      return { data: [result], error: null };
    }

    try {
      let result;
      const docData = {
        ...data,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      };
      
      if (docId) {
        await setDoc(doc(db, collectionName, docId), docData);
        result = { id: docId, ...convertTimestamps(docData) };
      } else {
        const docRef = await addDoc(collection(db, collectionName), docData);
        result = { id: docRef.id, ...convertTimestamps(docData) };
      }
      return { data: [result], error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  // Update a document
  async update(collectionName: string, docId: string, updates: any) {
    if (isDemoMode) {
      return { data: null, error: null };
    }

    try {
      await updateDoc(doc(db, collectionName, docId), {
        ...updates,
        updated_at: Timestamp.now(),
      });
      return { data: null, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  },

  // Delete a document
  async delete(collectionName: string, docId: string) {
    if (isDemoMode) {
      return { error: null };
    }

    try {
      await deleteDoc(doc(db, collectionName, docId));
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  },
};

// Query builder that mimics Supabase's query interface
export class QueryBuilder {
  private collectionName: string;
  private constraints: QueryConstraint[] = [];
  private selectFields: string[] = [];
  private isSingle = false;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  select(fields: string) {
    // Parse select fields - handle Supabase-style joins like "*, from_user:users!messages_from_user_id(full_name, email)"
    // Note: Firestore doesn't support joins, so we'll store the fields but can't actually join
    // The fields will be used to filter the response if needed
    const fieldList = fields.split(',').map(f => f.trim());
    
    // Extract base fields (non-join fields)
    const baseFields = fieldList.filter(f => !f.includes(':') && !f.includes('!'));
    this.selectFields = baseFields.length > 0 ? baseFields : fieldList;
    
    // Store join information for potential manual fetching later
    const joinFields = fieldList.filter(f => f.includes(':') || f.includes('!'));
    if (joinFields.length > 0) {
      console.warn('Firestore does not support joins. Related data will need to be fetched separately.');
    }
    
    return this;
  }

  insert(data: any) {
    // Return a chainable object that supports .select() and .single()
    const insertData = data;
    // IMPORTANT: If data contains an 'id' field, use it as the Firestore document ID
    // This is critical for security rules that check request.auth.uid == userId
    // (e.g., creating user profiles where the document ID must match the auth UID)
    const docId = insertData.id || undefined;
    
    return {
      select: (fields: string) => ({
        single: async () => {
          try {
            const result = await firestore.insert(this.collectionName, insertData, docId);
            if (result.data && result.data.length > 0) {
              return { data: result.data[0], error: result.error };
            }
            return { data: null, error: result.error || { message: 'No data returned' } };
          } catch (error: any) {
            return { data: null, error };
          }
        },
        then: async (resolve: any, reject: any) => {
          try {
            const result = await firestore.insert(this.collectionName, insertData, docId);
            if (result.error) {
              reject(result.error);
            } else {
              resolve(result);
            }
          } catch (error) {
            reject(error);
          }
        },
      }),
      single: async () => {
        try {
          const result = await firestore.insert(this.collectionName, insertData, docId);
          if (result.data && result.data.length > 0) {
            return { data: result.data[0], error: result.error };
          }
          return { data: null, error: result.error || { message: 'No data returned' } };
        } catch (error: any) {
          return { data: null, error };
        }
      },
      then: async (resolve: any, reject: any) => {
        try {
          const result = await firestore.insert(this.collectionName, insertData, docId);
          if (result.error) {
            reject(result.error);
          } else {
            resolve(result);
          }
        } catch (error) {
          reject(error);
        }
      },
    };
  }

  update(updates: any) {
    // Store updates and return chainable object
    const updateData = updates;
    return {
      eq: (field: string, value: any) => {
        return {
          then: async (resolve: any, reject: any) => {
            try {
              // Query to find the document
              const q = query(collection(db, this.collectionName), where(field, '==', value), limit(1));
              const snapshot = await getDocs(q);
              if (snapshot.empty) {
                reject({ message: 'Document not found' });
                return;
              }
              const docId = snapshot.docs[0].id;
              const result = await firestore.update(this.collectionName, docId, updateData);
              if (result.error) {
                reject(result.error);
              } else {
                resolve({ data: null, error: null });
              }
            } catch (error) {
              reject(error);
            }
          },
        };
      },
    };
  }

  delete() {
    return {
      eq: (field: string, value: any) => {
        return {
          then: async (resolve: any, reject: any) => {
            try {
              const q = query(collection(db, this.collectionName), where(field, '==', value), limit(1));
              const snapshot = await getDocs(q);
              if (snapshot.empty) {
                reject({ message: 'Document not found' });
                return;
              }
              const docId = snapshot.docs[0].id;
              const result = await firestore.delete(this.collectionName, docId);
              if (result.error) {
                reject(result.error);
              } else {
                resolve({ error: null });
              }
            } catch (error) {
              reject(error);
            }
          },
        };
      },
    };
  }

  eq(field: string, value: any) {
    this.constraints.push(where(field, '==', value));
    return this;
  }

  neq(field: string, value: any) {
    this.constraints.push(where(field, '!=', value));
    return this;
  }

  gt(field: string, value: any) {
    this.constraints.push(where(field, '>', value));
    return this;
  }

  gte(field: string, value: any) {
    this.constraints.push(where(field, '>=', value));
    return this;
  }

  lt(field: string, value: any) {
    this.constraints.push(where(field, '<', value));
    return this;
  }

  lte(field: string, value: any) {
    this.constraints.push(where(field, '<=', value));
    return this;
  }

  in(field: string, values: any[]) {
    this.constraints.push(where(field, 'in', values));
    return this;
  }

  is(field: string, value: any) {
    if (value === null) {
      // Firestore doesn't have a direct null check, we'd need a different approach
      // For now, we'll use a workaround
      this.constraints.push(where(field, '==', null));
    } else {
      this.constraints.push(where(field, '==', value));
    }
    return this;
  }

  or(condition: string) {
    // Parse Supabase-style .or() syntax: "and(field1.eq.value1,field2.eq.value2),and(field3.eq.value3)"
    // This is a simplified parser - for complex cases, queries may need restructuring
    try {
      // Split by comma to get individual conditions
      const conditions = condition.split(',').map(c => c.trim());
      const orConditions: any[] = [];
      
      for (const cond of conditions) {
        // Parse "and(field1.eq.value1,field2.eq.value2)" format
        if (cond.startsWith('and(') && cond.endsWith(')')) {
          const inner = cond.slice(4, -1);
          const parts = inner.split(',');
          const andConditions: any[] = [];
          
          for (const part of parts) {
            // Parse "field.eq.value" format
            const match = part.match(/(\w+)\.(eq|neq|gt|gte|lt|lte)\.(.+)/);
            if (match) {
              const [, field, op, value] = match;
              let firestoreOp: any = '==';
              if (op === 'neq') firestoreOp = '!=';
              else if (op === 'gt') firestoreOp = '>';
              else if (op === 'gte') firestoreOp = '>=';
              else if (op === 'lt') firestoreOp = '<';
              else if (op === 'lte') firestoreOp = '<=';
              
              // Try to parse value (could be a number, boolean, or string)
              let parsedValue: any = value;
              if (value === 'true') parsedValue = true;
              else if (value === 'false') parsedValue = false;
              else if (!isNaN(Number(value)) && value !== '') parsedValue = Number(value);
              
              andConditions.push(where(field, firestoreOp, parsedValue));
            }
          }
          
          if (andConditions.length > 0) {
            // For Firestore, we need to combine AND conditions differently
            // Since Firestore doesn't support complex OR with AND, we'll use a workaround
            // For now, just add the first condition (this is a limitation)
            if (andConditions.length === 1) {
              orConditions.push(andConditions[0]);
            } else {
              // Multiple AND conditions - Firestore limitation
              console.warn('Complex OR with multiple AND conditions may not work correctly in Firestore');
              orConditions.push(andConditions[0]);
            }
          }
        } else {
          // Simple condition like "field.eq.value"
          const match = cond.match(/(\w+)\.(eq|neq|gt|gte|lt|lte)\.(.+)/);
          if (match) {
            const [, field, op, value] = match;
            let firestoreOp: any = '==';
            if (op === 'neq') firestoreOp = '!=';
            else if (op === 'gt') firestoreOp = '>';
            else if (op === 'gte') firestoreOp = '>=';
            else if (op === 'lt') firestoreOp = '<';
            else if (op === 'lte') firestoreOp = '<=';
            
            let parsedValue: any = value;
            if (value === 'true') parsedValue = true;
            else if (value === 'false') parsedValue = false;
            else if (!isNaN(Number(value)) && value !== '') parsedValue = Number(value);
            
            orConditions.push(where(field, firestoreOp, parsedValue));
          }
        }
      }
      
      if (orConditions.length > 0) {
        // Firestore supports OR with up to 30 conditions
        if (orConditions.length === 1) {
          this.constraints.push(orConditions[0]);
        } else if (orConditions.length <= 30) {
          this.constraints.push(or(...orConditions));
        } else {
          console.warn('Too many OR conditions (max 30 in Firestore)');
          this.constraints.push(or(...orConditions.slice(0, 30)));
        }
      }
    } catch (error) {
      console.warn('Error parsing .or() condition:', error);
      // Fallback: don't add any constraint
    }
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.constraints.push(orderBy(field, options?.ascending !== false ? 'asc' : 'desc'));
    return this;
  }

  limit(count: number) {
    this.constraints.push(limit(count));
    return this;
  }

  single() {
    this.isSingle = true;
    this.constraints.push(limit(1));
    return this;
  }

  async then(resolve: any, reject: any) {
    try {
      const result = await firestore.query(this.collectionName, this.constraints);
      
      // Filter fields if select was used
      let filteredData = result.data;
      if (this.selectFields.length > 0 && !this.selectFields.includes('*')) {
        filteredData = result.data?.map((item: any) => {
          const filtered: any = { id: item.id };
          this.selectFields.forEach(field => {
            if (item[field] !== undefined) {
              filtered[field] = item[field];
            }
          });
          return filtered;
        });
      }
      
      if (this.isSingle) {
        if (filteredData && filteredData.length > 0) {
          resolve({ data: filteredData[0], error: null });
        } else {
          resolve({ data: null, error: null });
        }
      } else {
        resolve({ data: filteredData || [], error: result.error });
      }
    } catch (error) {
      reject(error);
    }
  }
}

// Main database interface that mimics Supabase
export const dbService = {
  from(collectionName: string) {
    return new QueryBuilder(collectionName);
  },
};

// For compatibility with existing code - create a Supabase-like interface
import { storageService } from './storage';

export const createSupabaseClient = () => ({
  from: (collectionName: string) => new QueryBuilder(collectionName),
  storage: {
    from: (bucketName: string) => ({
      upload: async (path: string, file: File) => {
        try {
          const result = await storageService.upload(bucketName, path, file);
          if (result.error) {
            return { error: result.error };
          }
          return { error: null };
        } catch (error: any) {
          return { error };
        }
      },
      getPublicUrl: async (path: string) => {
        try {
          const result = await storageService.getPublicUrl(bucketName, path);
          return { data: { publicUrl: result.publicUrl } };
        } catch (error: any) {
          return { data: { publicUrl: null }, error };
        }
      },
    }),
  },
  auth: {
    signUp: async (options: any) => {
      // Redirect to authService but maintain compatibility
      const { authService } = await import('./auth');
      return await authService.signUp({
        email: options.email,
        password: options.password,
        fullName: options.options?.data?.full_name,
        role: options.options?.data?.role,
        employeeCategory: options.options?.data?.employee_category,
      });
    },
  },
  rpc: async (functionName: string, params: any) => {
    // Firestore doesn't have RPC functions like Supabase
    // These are implemented as client-side helper functions
    const { generateEmployeeId, generateCustomerId, generateLoanNumber } = await import('./helpers');
    
    switch (functionName) {
      case 'generate_employee_id':
        try {
          const employeeId = await generateEmployeeId(params.agency_id);
          return { data: employeeId, error: null };
        } catch (error: any) {
          return { data: null, error };
        }
      case 'generate_customer_id':
        try {
          const customerId = await generateCustomerId(params.agency_id);
          return { data: customerId, error: null };
        } catch (error: any) {
          return { data: null, error };
        }
      case 'generate_loan_number':
        try {
          const loanNumber = await generateLoanNumber(params.agency_id);
          return { data: loanNumber, error: null };
        } catch (error: any) {
          return { data: null, error };
        }
      default:
        console.warn(`RPC function ${functionName} called - not implemented`);
        return { data: null, error: { message: `RPC function ${functionName} not available` } };
    }
  },
});

// Export singleton instance
export const supabase = createSupabaseClient();

