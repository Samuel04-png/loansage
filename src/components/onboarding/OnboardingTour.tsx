/**
 * Onboarding Tour Component
 * Uses driver.js to show a guided tour on first login
 */

import { useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuth } from '../../hooks/useAuth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase/config';

interface OnboardingTourProps {
  role: 'admin' | 'employee' | 'customer';
}

export function OnboardingTour({ role }: OnboardingTourProps) {
  const { user } = useAuth();
  const driverRef = useRef<any>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const checkAndStartTour = async () => {
      try {
        // Check if user has seen the tour
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        if (userData?.hasSeenTour?.[role] === true) {
          return; // User has already seen the tour for this role
        }

        // Initialize driver.js
        const driverObj = driver({
          showProgress: true,
          showButtons: ['next', 'previous', 'close'],
          steps: getTourSteps(role),
          onDestroyStarted: async () => {
            // Mark tour as seen when user closes it
            await setDoc(
              userRef,
              {
                hasSeenTour: {
                  ...(userData?.hasSeenTour || {}),
                  [role]: true,
                },
                updatedAt: new Date(),
              },
              { merge: true }
            );
          },
        });

        driverRef.current = driverObj;

        // Start tour after a short delay to ensure DOM is ready
        setTimeout(() => {
          driverObj.drive();
        }, 1000);
      } catch (error) {
        console.error('Error initializing onboarding tour:', error);
      }
    };

    checkAndStartTour();

    // Cleanup
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    };
  }, [user?.uid, role]);

  return null; // This component doesn't render anything
}

function getTourSteps(role: 'admin' | 'employee' | 'customer') {
  const commonSteps = [
    {
      element: '[data-tour="dashboard"]',
      popover: {
        title: 'Welcome to TengaLoans! 👋',
        description: 'This is your dashboard. Here you can see an overview of your key metrics and recent activity.',
        side: 'bottom',
        align: 'start',
      },
    },
  ];

  if (role === 'admin') {
    return [
      ...commonSteps,
      {
        element: '[data-tour="customers"]',
        popover: {
          title: 'Manage Customers',
          description: 'View and manage all your customers. Add new customers, update information, and track their loan history.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="loans"]',
        popover: {
          title: 'Loan Management',
          description: 'Track all loans, view status, approve applications, and manage repayments from one central location.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="reports"]',
        popover: {
          title: 'Analytics & Reports',
          description: 'Generate detailed reports, view analytics, and gain insights into your lending operations.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="settings"]',
        popover: {
          title: 'Settings',
          description: 'Configure your agency settings, manage users, and customize your experience.',
          side: 'right',
          align: 'start',
        },
      },
    ];
  }

  if (role === 'employee') {
    return [
      ...commonSteps,
      {
        element: '[data-tour="create-loan"]',
        popover: {
          title: 'Create New Loans',
          description: 'Start here to create a new loan application. The wizard will guide you through the process.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="customers"]',
        popover: {
          title: 'Customer Management',
          description: 'View your assigned customers, add new ones, and manage their information.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="loans"]',
        popover: {
          title: 'Your Loans',
          description: 'Track all loans you\'ve created or are managing. Filter by status, search, and take actions.',
          side: 'right',
          align: 'start',
        },
      },
    ];
  }

  if (role === 'customer') {
    return [
      ...commonSteps,
      {
        element: '[data-tour="my-loans"]',
        popover: {
          title: 'My Loans',
          description: 'View all your active loans, check balances, payment schedules, and loan details.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="payments"]',
        popover: {
          title: 'Make Payments',
          description: 'View your payment history and make payments towards your loans.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '[data-tour="documents"]',
        popover: {
          title: 'Documents',
          description: 'Access all your loan documents, contracts, and statements in one place.',
          side: 'right',
          align: 'start',
        },
      },
    ];
  }

  return commonSteps;
}
