import { Borrower, Loan, LoanStatus, CollateralType } from './types';

export const MOCK_BORROWERS: Borrower[] = [
  {
    id: 'b_1',
    name: 'Sarah Mumba',
    email: 'sarah.m@example.com',
    phone: '+260 97 123 4567',
    riskScore: 85,
    nrcNumber: '123456/11/1',
    tenantId: 'tenant_A',
    photoUrl: 'https://picsum.photos/200/200?random=1',
    kycStatus: 'VERIFIED',
    documents: []
  },
  {
    id: 'b_2',
    name: 'John Banda',
    email: 'john.b@example.com',
    phone: '+260 96 765 4321',
    riskScore: 62,
    nrcNumber: '654321/11/1',
    tenantId: 'tenant_A',
    photoUrl: 'https://picsum.photos/200/200?random=2',
    kycStatus: 'VERIFIED',
    documents: []
  },
  {
    id: 'b_3',
    name: 'Grace Lungu',
    email: 'grace.l@example.com',
    phone: '+260 95 555 1212',
    riskScore: 92,
    nrcNumber: '998877/11/1',
    tenantId: 'tenant_A',
    photoUrl: 'https://picsum.photos/200/200?random=3',
    kycStatus: 'VERIFIED',
    documents: []
  }
];

export const MOCK_LOANS: Loan[] = [
  {
    id: 'l_101',
    borrowerId: 'b_1',
    borrowerName: 'Sarah Mumba',
    amount: 50000,
    currency: 'ZMW',
    interestRate: 15,
    durationMonths: 12,
    startDate: '2023-10-15',
    status: LoanStatus.ACTIVE,
    repaymentProgress: 45,
    tenantId: 'tenant_A',
    collateral: [
      {
        id: 'c_1',
        type: CollateralType.VEHICLE,
        description: 'Toyota Corolla 2018',
        value: 120000,
        currency: 'ZMW',
        imageUrl: 'https://picsum.photos/400/300?random=10',
        status: 'VERIFIED'
      }
    ]
  },
  {
    id: 'l_102',
    borrowerId: 'b_2',
    borrowerName: 'John Banda',
    amount: 15000,
    currency: 'ZMW',
    interestRate: 20,
    durationMonths: 6,
    startDate: '2024-01-10',
    status: LoanStatus.APPROVED,
    repaymentProgress: 0,
    tenantId: 'tenant_A',
    collateral: [
      {
        id: 'c_2',
        type: CollateralType.ELECTRONICS,
        description: 'MacBook Pro M1',
        value: 25000,
        currency: 'ZMW',
        imageUrl: 'https://picsum.photos/400/300?random=11',
        status: 'VERIFIED'
      }
    ]
  },
  {
    id: 'l_103',
    borrowerId: 'b_3',
    borrowerName: 'Grace Lungu',
    amount: 250000,
    currency: 'ZMW',
    interestRate: 12,
    durationMonths: 24,
    startDate: '2023-05-20',
    status: LoanStatus.ACTIVE,
    repaymentProgress: 80,
    tenantId: 'tenant_A',
    collateral: [
      {
        id: 'c_3',
        type: CollateralType.PROPERTY,
        description: 'Plot 405, Lusaka West',
        value: 450000,
        currency: 'ZMW',
        imageUrl: 'https://picsum.photos/400/300?random=12',
        status: 'VERIFIED'
      }
    ]
  }
];