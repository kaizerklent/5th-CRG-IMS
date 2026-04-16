import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
  EmailAuthProvider,
} from 'firebase/auth';
import { auth } from './firebaseConfig';

export const signIn = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const logOut = () => signOut(auth);

export const sendPasswordReset = (email: string) =>
  sendPasswordResetEmail(auth, email);

export async function changePassword(currentPw: string, newPw: string): Promise<void> {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('No authenticated user');
  const cred = EmailAuthProvider.credential(user.email, currentPw);
  await reauthenticateWithCredential(user, cred);
  await updatePassword(user, newPw);
}

export async function updateDisplayName(name: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  await updateProfile(user, { displayName: name });
}
