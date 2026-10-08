'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Purchase Modal Flow State
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState('AUTH'); // 'AUTH' | 'REVIEW' | 'PAYMENT' | 'SUCCESS' | 'FAILED'
  const [customerToken, setCustomerToken] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [directTokenInput, setDirectTokenInput] = useState('');
  const [showDirectToken, setShowDirectToken] = useState(false);

  // Order & Razorpay State
  const [orderData, setOrderData] = useState(null);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [activationResult, setActivationResult] = useState(null);

  // Load Active Plans from Authoritative PostgreSQL Endpoint
  async function fetchPlans() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/public/subscriptions/plans');
      if (!res.ok) {
        throw new Error('Unable to retrieve subscription plans from server.');
      }
      const json = await res.json();
      setPlans(json.data || []);
    } catch (err) {
      console.error('[SUBSCRIPTIONS FETCH ERROR]', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPlans();

    // Check for existing customer session in localStorage
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('pondfish_customer_token');
      if (savedToken) {
        setCustomerToken(savedToken);
      }
      const savedInfo = localStorage.getItem('pondfish_customer_info');
      if (savedInfo) {
        try {
          const parsed = JSON.parse(savedInfo);
          if (parsed && parsed.mobileNumber) {
            setCustomerMobile(parsed.mobileNumber);
          }
        } catch (_) {}
      }
    }
  }, []);

  // Initiate purchase modal for a selected plan
  function handleSelectPlan(plan) {
    setSelectedPlan(plan);
    setPaymentError('');
    setAuthError('');
    setActivationResult(null);

    const token = typeof window !== 'undefined' ? localStorage.getItem('pondfish_customer_token') : '';
    if (token) {
      setCustomerToken(token);
      setCurrentStep('REVIEW');
    } else {
      setCurrentStep('AUTH');
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedPlan(null);
    setPaymentError('');
    setAuthError('');
    setProcessingOrder(false);
  }

  // Customer OTP Send
  async function handleSendOtp(e) {
    if (e) e.preventDefault();
    setAuthError('');
    const cleanMobile = customerMobile.replace(/\D/g, '').slice(-10);
    if (!cleanMobile || cleanMobile.length !== 10) {
      setAuthError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch('/api/v1/customer/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: cleanMobile }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to dispatch verification OTP.');
      }
      setOtpSent(true);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // Customer Direct Token Login (supports existing customer session)
  function handleApplyDirectToken(e) {
    if (e) e.preventDefault();
    setAuthError('');
    const token = directTokenInput.trim();
    if (!token) {
      setAuthError('Please enter a valid customer session token.');
      return;
    }
    setCustomerToken(token);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pondfish_customer_token', token);
    }
    setCurrentStep('REVIEW');
  }

  // Customer OTP Verification
  async function handleVerifyOtp(e) {
    if (e) e.preventDefault();
    setAuthError('');
    const cleanMobile = customerMobile.replace(/\D/g, '').slice(-10);

    if (!otpInput.trim()) {
      setAuthError('Please enter the received OTP code.');
      return;
    }

    setAuthLoading(true);
    try {
      const res = await fetch('/api/v1/customer/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobileNumber: cleanMobile,
          idToken: otpInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Authentication verification failed.');
      }

      const token = data.data.token;
      setCustomerToken(token);
      if (typeof window !== 'undefined') {
        localStorage.setItem('pondfish_customer_token', token);
        localStorage.setItem('pondfish_customer_info', JSON.stringify(data.data.customer));
      }
      setCurrentStep('REVIEW');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  // Step 2 -> 3: Proceed to Razorpay Payment Order Generation
  async function handleProceedToPayment() {
    if (!selectedPlan || !customerToken) {
      setCurrentStep('AUTH');
      return;
    }

    setPaymentError('');
    setProcessingOrder(true);

    try {
      const res = await fetch('/api/v1/customer/subscription/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({ planId: selectedPlan.id }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        if (res.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('pondfish_customer_token');
          }
          setCustomerToken('');
          setCurrentStep('AUTH');
          setAuthError('Your customer session expired. Please sign in again.');
          return;
        }
        if (json.error?.code === 'PAYMENT_GATEWAY_NOT_CONFIGURED') {
          throw new Error('Payment gateway credentials are not configured on this server. Please contact our Bangalore store counter.');
        }
        throw new Error(json.error?.message || 'Failed to initiate subscription purchase order.');
      }

      setOrderData(json.data);
      launchRazorpayCheckout(json.data);
    } catch (err) {
      console.error('[PURCHASE INITIATION ERROR]', err.message);
      setPaymentError(err.message);
      setCurrentStep('FAILED');
    } finally {
      setProcessingOrder(false);
    }
  }

  // Dynamically load Razorpay SDK and trigger checkout modal
  function launchRazorpayCheckout(orderInfo) {
    function loadScript(src) {
      return new Promise((resolve) => {
        if (window.Razorpay) {
          resolve(true);
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });
    }

    loadScript('https://checkout.razorpay.com/v1/checkout.js').then((loaded) => {
      if (!loaded || !window.Razorpay) {
        setPaymentError('Failed to load secure Razorpay checkout gateway. Please check your connection.');
        setCurrentStep('FAILED');
        return;
      }

      const options = {
        key: orderInfo.keyId,
        amount: orderInfo.amountPaise,
        currency: orderInfo.currency || 'INR',
        name: 'PondFish Lake Catch',
        description: `Subscription: ${selectedPlan.title}`,
        order_id: orderInfo.orderId,
        prefill: {
          contact: customerMobile || '',
        },
        theme: {
          color: '#0284C7',
        },
        handler: async function (response) {
          // Razorpay payment success callback -> Trigger Server-Side HMAC Verification
          await verifySubscriptionPayment(response);
        },
        modal: {
          ondismiss: function () {
            // Traceability: PW-04 Design Spec exact requirement:
            // "Subscription payment was not completed. You can retry the payment."
            setPaymentError('Subscription payment was not completed. You can retry the payment.');
            setCurrentStep('FAILED');
          },
        },
      };

      try {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } catch (rzpErr) {
        console.error('[RAZORPAY OPEN ERROR]', rzpErr.message);
        setPaymentError(rzpErr.message || 'Unable to open payment modal.');
        setCurrentStep('FAILED');
      }
    });
  }

  // Step 4: Server-Side HMAC Signature Verification & Atomic Activation
  async function verifySubscriptionPayment(paymentResponse) {
    setProcessingOrder(true);
    setPaymentError('');

    try {
      const res = await fetch('/api/v1/customer/subscription/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${customerToken}`,
        },
        body: JSON.stringify({
          planId: selectedPlan.id,
          razorpayOrderId: paymentResponse.razorpay_order_id,
          razorpayPaymentId: paymentResponse.razorpay_payment_id,
          razorpaySignature: paymentResponse.razorpay_signature,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Payment verification failed on server.');
      }

      // Acceptance Criteria: Subscription is not shown as active before server-verified payment.
      setActivationResult(json.data);
      setCurrentStep('SUCCESS');
    } catch (err) {
      console.error('[SERVER VERIFICATION ERROR]', err.message);
      // Fallback message per PW-04 spec
      setPaymentError(err.message || 'Subscription payment was not completed. You can retry the payment.');
      setCurrentStep('FAILED');
    } finally {
      setProcessingOrder(false);
    }
  }

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '48px 24px', width: '100%' }}>
      {/* 1. Header Section */}
      <div style={{ textAlign: 'center', marginBottom: '48px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(2, 132, 199, 0.15)',
          border: '1px solid rgba(2, 132, 199, 0.3)',
          padding: '6px 14px',
          borderRadius: '20px',
          color: '#38BDF8',
          fontSize: '12px',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          marginBottom: '16px'
        }}>
          💎 PondFish Subscription Memberships
        </div>
        <h1 style={{ fontSize: '38px', fontWeight: '900', color: '#F8FAFC', letterSpacing: '-0.5px', marginBottom: '16px' }}>
          Fresh Catch Subscription Plans
        </h1>
        <p style={{ fontSize: '16px', color: '#94A3B8', maxWidth: '720px', margin: '0 auto', lineHeight: '1.6' }}>
          Subscriptions convert your upfront plan fee into PondFish Store Credit to spend on daily fresh lake harvest, combined with a weekly quantity allowance to reserve prime morning catches.
        </p>
      </div>

      {/* 2. Visual Direction Callout: Store Credit Concept (PW-04 Spec) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(2, 132, 199, 0.15) 100%)',
        border: '1px solid #0284C7',
        borderRadius: '16px',
        padding: '28px 32px',
        marginBottom: '48px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px'
      }}>
        <div style={{ maxWidth: '640px' }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
            Store Credit & Weekly Allowance
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
            Upfront Plan Fees Become PondFish Store Credit
          </h2>
          <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.6', margin: 0 }}>
            Subscriptions convert your upfront plan fee into PondFish Store Credit to spend on daily fresh lake harvest, combined with a weekly quantity allowance to reserve prime morning catches before walk-ins open.
          </p>
        </div>
        <div style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <div style={{
            background: '#0B1120',
            border: '1px solid #1E293B',
            borderRadius: '10px',
            padding: '14px 20px',
            textAlign: 'center',
            minWidth: '140px'
          }}>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#22C55E' }}>Store Credit</div>
            <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>Account Balance</div>
          </div>
          <div style={{
            background: '#0B1120',
            border: '1px solid #1E293B',
            borderRadius: '10px',
            padding: '14px 20px',
            textAlign: 'center',
            minWidth: '140px'
          }}>
            <div style={{ fontSize: '20px', fontWeight: '900', color: '#38BDF8' }}>Weekly Quota</div>
            <div style={{ fontSize: '12px', color: '#94A3B8', fontWeight: '600' }}>Weight Allowance</div>
          </div>
        </div>
      </div>

      {/* 3. Subscription Plans Grid */}
      {loading ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '28px',
          marginBottom: '56px'
        }}>
          {[1, 2].map((i) => (
            <div
              key={i}
              style={{
                background: '#0F172A',
                border: '1px solid #1E293B',
                borderRadius: '16px',
                padding: '36px 32px',
                height: '480px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ width: '100px', height: '24px', borderRadius: '4px', background: '#1E293B', marginBottom: '20px' }}></div>
                <div style={{ width: '60%', height: '36px', borderRadius: '4px', background: '#1E293B', marginBottom: '12px' }}></div>
                <div style={{ width: '85%', height: '16px', borderRadius: '4px', background: '#1E293B', marginBottom: '28px' }}></div>
                <div style={{ width: '100%', height: '60px', borderRadius: '8px', background: '#1E293B', marginBottom: '24px' }}></div>
              </div>
              <div style={{ width: '100%', height: '48px', borderRadius: '8px', background: '#1E293B' }}></div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Subscription Plans Unavailable"
          message={error}
          onRetry={fetchPlans}
        />
      ) : plans.length === 0 ? (
        <EmptyState
          title="No Subscription Plans Configured"
          message="Subscription plans are currently undergoing seasonal review. Please visit our Bangalore counter for walk-in fresh catch rates."
          actionText="Browse Fish Catalogue"
          actionHref="/fish"
        />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '28px',
          marginBottom: '64px'
        }}>
          {plans.map((plan) => (
            <div
              key={plan.id}
              style={{
                background: '#0F172A',
                border: '1px solid #1E293B',
                borderRadius: '16px',
                padding: '36px 32px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative'
              }}
            >
              <div>
                {/* Plan Title */}
                <h3 style={{ fontSize: '24px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
                  {plan.title}
                </h3>

                {/* Price */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '20px' }}>
                  <span style={{ fontSize: '38px', fontWeight: '900', color: '#F8FAFC' }}>
                    ₹{plan.price.toLocaleString('en-IN')}
                  </span>
                  <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: '500' }}>
                    / {plan.validityDays} days validity
                  </span>
                </div>

                {/* Store Credit Box */}
                <div style={{
                  background: 'rgba(2, 132, 199, 0.1)',
                  border: '1px solid rgba(2, 132, 199, 0.3)',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                    Monetary Store Credit
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#22C55E' }}>
                    Get ₹{plan.creditAmount.toLocaleString('en-IN')} Store Credit
                  </div>
                  <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px', lineHeight: '1.4' }}>
                    Full monetary balance credited to your account balance to spend on fresh lake catch.
                  </div>
                </div>

                {/* Weekly Limits & Key Features List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px' }}>
                    <span style={{ color: '#38BDF8', fontSize: '16px' }}>⚖️</span>
                    <div>
                      <strong style={{ color: '#F8FAFC' }}>Weekly Reservation Quota:</strong>{' '}
                      <span style={{ color: '#94A3B8' }}>Up to <strong style={{ color: '#38BDF8' }}>{plan.weeklyQtyLimitKg} kg/week</strong> priority reserve allowance.</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px' }}>
                    <span style={{ color: '#22C55E', fontSize: '16px' }}>✓</span>
                    <div>
                      <strong style={{ color: '#F8FAFC' }}>Store Credit Balance:</strong>{' '}
                      <span style={{ color: '#94A3B8' }}>Valid against all eligible daily fresh fish varieties at Bangalore counter.</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px' }}>
                    <span style={{ color: '#22C55E', fontSize: '16px' }}>✓</span>
                    <div>
                      <strong style={{ color: '#F8FAFC' }}>07:00 AM Morning Truck Priority:</strong>{' '}
                      <span style={{ color: '#94A3B8' }}>Lock in peak freshness before the morning walk-in counter rush.</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '14px' }}>
                    <span style={{ color: '#22C55E', fontSize: '16px' }}>✓</span>
                    <div>
                      <strong style={{ color: '#F8FAFC' }}>Validity Window:</strong>{' '}
                      <span style={{ color: '#94A3B8' }}>Active for {plan.validityDays} days from server activation.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Purchase CTA Button */}
              <button
                onClick={() => handleSelectPlan(plan)}
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  background: '#0284C7',
                  color: '#FFFFFF',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: '700',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)'
                }}
              >
                <span>Subscribe to {plan.title}</span>
                <span>&rarr;</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 4. Educational Section: Weekly Allowance vs. Monetary Credit (PW-04 Acceptance Criteria) */}
      <div style={{
        background: '#0F172A',
        border: '1px solid #1E293B',
        borderRadius: '16px',
        padding: '36px',
        marginBottom: '64px'
      }}>
        <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#F8FAFC', marginBottom: '16px' }}>
          Understanding Your Subscription: Credit vs. Weekly Allowance
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px'
        }}>
          <div style={{ background: '#0B1120', padding: '24px', borderRadius: '10px', border: '1px solid #334155' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>💰</div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#F8FAFC', marginBottom: '8px' }}>
              Monetary Store Credit (₹)
            </h3>
            <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.6' }}>
              This is your stored rupee balance. When you collect or order fish, the itemized total is deducted from this credit balance. You pay zero extra unless your order exceeds this amount.
            </p>
          </div>

          <div style={{ background: '#0B1120', padding: '24px', borderRadius: '10px', border: '1px solid #334155' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>⚖️</div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#F8FAFC', marginBottom: '8px' }}>
              Weekly Allowance Quota (kg)
            </h3>
            <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.6' }}>
              The weekly weight quota (e.g. 2 kg to 3 kg/week depending on plan) protects supply integrity. It allows home subscribers to reserve premium morning truck arrivals while preventing commercial hoarding.
            </p>
          </div>

          <div style={{ background: '#0B1120', padding: '24px', borderRadius: '10px', border: '1px solid #334155' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>🔒</div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#F8FAFC', marginBottom: '8px' }}>
              Bank-Verified Security
            </h3>
            <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: '1.6' }}>
              Payments are executed via official Razorpay gateway with server-side HMAC-SHA256 signature verification. No subscription activates without confirmed bank settlement.
            </p>
          </div>
        </div>
      </div>

      {/* 5. INTERACTIVE PURCHASE & AUTH MODAL (PW-04 Vertical Slice) */}
      {modalOpen && selectedPlan && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            background: '#0F172A',
            border: '1px solid #334155',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            padding: '32px',
            maxHeight: '90vh',
            overflowY: 'auto',
            position: 'relative',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
          }}>
            {/* Modal Close Button */}
            <button
              onClick={closeModal}
              aria-label="Close dialog"
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'transparent',
                border: 'none',
                color: '#94A3B8',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px 8px'
              }}
            >
              ✕
            </button>

            {/* FLOW STEP: AUTHENTICATION */}
            {currentStep === 'AUTH' && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#0284C7', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                  Step 1 of 3 • Customer Verification
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#F8FAFC', marginBottom: '12px' }}>
                  Sign In to Subscribe
                </h3>
                <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.5', marginBottom: '24px' }}>
                  Subscriptions are associated with your PondFish customer profile to manage your store credit and booking quota.
                </p>

                {authError && (
                  <div style={{
                    background: 'rgba(220, 38, 38, 0.15)',
                    border: '1px solid #DC2626',
                    borderRadius: '8px',
                    padding: '12px',
                    color: '#FCA5A5',
                    fontSize: '13px',
                    marginBottom: '20px',
                    lineHeight: '1.4'
                  }}>
                    {authError}
                  </div>
                )}

                {!showDirectToken ? (
                  <div>
                    <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#F8FAFC', marginBottom: '6px' }}>
                          Mobile Number
                        </label>
                        <div style={{ display: 'flex' }}>
                          <span style={{
                            padding: '10px 14px',
                            background: '#1E293B',
                            border: '1px solid #334155',
                            borderRight: 'none',
                            borderRadius: '8px 0 0 8px',
                            color: '#94A3B8',
                            fontSize: '14px',
                            fontWeight: '600'
                          }}>
                            +91
                          </span>
                          <input
                            type="tel"
                            maxLength={10}
                            placeholder="9876543210"
                            value={customerMobile}
                            onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, ''))}
                            disabled={otpSent}
                            style={{
                              flex: 1,
                              padding: '10px 14px',
                              background: '#0B1120',
                              border: '1px solid #334155',
                              borderRadius: '0 8px 8px 0',
                              color: '#F8FAFC',
                              fontSize: '14px',
                              outline: 'none'
                            }}
                          />
                        </div>
                      </div>

                      {otpSent && (
                        <div style={{ marginBottom: '20px' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#F8FAFC', marginBottom: '6px' }}>
                            Verification OTP Code / ID Token
                          </label>
                          <input
                            type="text"
                            placeholder="Enter 6-digit OTP or token"
                            value={otpInput}
                            onChange={(e) => setOtpInput(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              background: '#0B1120',
                              border: '1px solid #334155',
                              borderRadius: '8px',
                              color: '#F8FAFC',
                              fontSize: '14px',
                              outline: 'none'
                            }}
                          />
                          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px' }}>
                            OTP dispatch logged to PondFish auth service.
                          </div>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={authLoading}
                        style={{
                          width: '100%',
                          padding: '12px 20px',
                          background: '#0284C7',
                          color: '#FFFFFF',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '700',
                          border: 'none',
                          cursor: authLoading ? 'not-allowed' : 'pointer',
                          opacity: authLoading ? 0.7 : 1,
                          marginBottom: '16px'
                        }}
                      >
                        {authLoading ? 'Verifying...' : otpSent ? 'Verify OTP & Continue' : 'Request OTP Code'}
                      </button>
                    </form>

                    <button
                      type="button"
                      onClick={() => setShowDirectToken(true)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#38BDF8',
                        fontSize: '12px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        width: '100%',
                        textDecoration: 'underline'
                      }}
                    >
                      Already have an active session token? Enter directly
                    </button>
                  </div>
                ) : (
                  <div>
                    <form onSubmit={handleApplyDirectToken}>
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#F8FAFC', marginBottom: '6px' }}>
                          Customer Session Token (Bearer JWT)
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Paste PondFish customer session token..."
                          value={directTokenInput}
                          onChange={(e) => setDirectTokenInput(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: '#0B1120',
                            border: '1px solid #334155',
                            borderRadius: '8px',
                            color: '#F8FAFC',
                            fontSize: '13px',
                            fontFamily: 'monospace',
                            outline: 'none',
                            resize: 'vertical'
                          }}
                        />
                      </div>

                      <button
                        type="submit"
                        style={{
                          width: '100%',
                          padding: '12px 20px',
                          background: '#0284C7',
                          color: '#FFFFFF',
                          borderRadius: '8px',
                          fontSize: '14px',
                          fontWeight: '700',
                          border: 'none',
                          cursor: 'pointer',
                          marginBottom: '16px'
                        }}
                      >
                        Use Customer Session &rarr;
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowDirectToken(false)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94A3B8',
                          fontSize: '12px',
                          cursor: 'pointer',
                          textAlign: 'center',
                          width: '100%'
                        }}
                      >
                        &larr; Back to Mobile Phone Sign In
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* FLOW STEP: REVIEW ORDER & ACCEPT TERMS (PW-04 Spec) */}
            {currentStep === 'REVIEW' && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#0284C7', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>
                  Step 2 of 3 • Review & Confirm
                </div>
                <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#F8FAFC', marginBottom: '16px' }}>
                  Review Subscription Order
                </h3>

                {/* Plan Summary Card */}
                <div style={{
                  background: '#0B1120',
                  border: '1px solid #1E293B',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: '#94A3B8' }}>Selected Plan:</span>
                    <strong style={{ fontSize: '15px', color: '#F8FAFC' }}>{selectedPlan.title}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: '#94A3B8' }}>Payable Amount:</span>
                    <strong style={{ fontSize: '16px', color: '#38BDF8' }}>₹{selectedPlan.price.toLocaleString('en-IN')}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: '#94A3B8' }}>PondFish Store Credit:</span>
                    <strong style={{ fontSize: '15px', color: '#22C55E' }}>₹{selectedPlan.creditAmount.toLocaleString('en-IN')}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '14px', color: '#94A3B8' }}>Weekly Reservation Quota:</span>
                    <strong style={{ fontSize: '14px', color: '#F8FAFC' }}>{selectedPlan.weeklyQtyLimitKg} kg/week</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #1E293B' }}>
                    <span style={{ fontSize: '14px', color: '#94A3B8' }}>Plan Validity:</span>
                    <strong style={{ fontSize: '14px', color: '#F8FAFC' }}>{selectedPlan.validityDays} Days</strong>
                  </div>
                </div>

                {/* Visible Terms Before Purchase (Acceptance Criteria) */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid #1E293B',
                  borderRadius: '10px',
                  padding: '16px',
                  marginBottom: '24px',
                  fontSize: '12px',
                  color: '#94A3B8',
                  lineHeight: '1.6'
                }}>
                  <strong style={{ color: '#F8FAFC', display: 'block', marginBottom: '6px' }}>
                    Membership Terms & Rules:
                  </strong>
                  <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <li>100% of ₹{selectedPlan.price} is credited to your customer store wallet upon verified payment.</li>
                    <li>Weekly limit of {selectedPlan.weeklyQtyLimitKg} kg resets every week to guarantee fair catch distribution.</li>
                    <li>Payments are securely processed via Razorpay. Activations occur immediately upon bank confirmation.</li>
                  </ul>
                </div>

                {/* Action Buttons */}
                <button
                  onClick={handleProceedToPayment}
                  disabled={processingOrder}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    background: '#0284C7',
                    color: '#FFFFFF',
                    borderRadius: '8px',
                    fontSize: '15px',
                    fontWeight: '700',
                    border: 'none',
                    cursor: processingOrder ? 'not-allowed' : 'pointer',
                    opacity: processingOrder ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    marginBottom: '12px'
                  }}
                >
                  {processingOrder ? 'Generating Razorpay Order...' : `Proceed to Pay ₹${selectedPlan.price.toLocaleString('en-IN')}`}
                  {!processingOrder && <span>&rarr;</span>}
                </button>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        localStorage.removeItem('pondfish_customer_token');
                      }
                      setCustomerToken('');
                      setCurrentStep('AUTH');
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748B',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Switch Account / Sign Out
                  </button>

                  <button
                    onClick={closeModal}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94A3B8',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* FLOW STEP: PAYMENT FAILED / CANCELLED (PW-04 Spec) */}
            {currentStep === 'FAILED' && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(220, 38, 38, 0.15)',
                    color: '#DC2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    margin: '0 auto 16px'
                  }}>
                    ✕
                  </div>
                  <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
                    Payment Incomplete
                  </h3>
                  {/* Traceability: PW-04 Design Spec exact string requirement */}
                  <div style={{
                    background: 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    borderRadius: '8px',
                    padding: '14px',
                    color: '#FCA5A5',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    marginBottom: '16px'
                  }}>
                    <p style={{ margin: 0, fontWeight: '600' }}>
                      Subscription payment was not completed.
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#F87171' }}>
                      You can retry the payment.
                    </p>
                  </div>
                  {paymentError && paymentError !== 'Subscription payment was not completed. You can retry the payment.' && (
                    <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>
                      Server note: {paymentError}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={() => {
                      setCurrentStep('REVIEW');
                      setPaymentError('');
                    }}
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      background: '#0284C7',
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '700',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    Retry Payment
                  </button>
                  <button
                    onClick={closeModal}
                    style={{
                      flex: 1,
                      padding: '12px 20px',
                      background: '#1E293B',
                      color: '#94A3B8',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      border: '1px solid #334155',
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* FLOW STEP: ACTIVATION SUCCESS (PW-04 Spec) */}
            {currentStep === 'SUCCESS' && activationResult && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#22C55E',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    margin: '0 auto 16px'
                  }}>
                    ✓
                  </div>
                  <h3 style={{ fontSize: '22px', fontWeight: '800', color: '#F8FAFC', marginBottom: '8px' }}>
                    Subscription Activated!
                  </h3>
                  <p style={{ fontSize: '14px', color: '#94A3B8', lineHeight: '1.5' }}>
                    Your subscription to <strong style={{ color: '#F8FAFC' }}>{selectedPlan.title}</strong> is now verified and active. ₹{parseFloat(activationResult.ledger?.resulting_balance || selectedPlan.creditAmount).toLocaleString('en-IN')} Store Credit has been credited to your account balance.
                  </p>
                </div>

                <div style={{
                  background: '#0B1120',
                  border: '1px solid #1E293B',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '24px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', color: '#94A3B8' }}>Available Store Credit:</span>
                    <strong style={{ fontSize: '16px', color: '#22C55E' }}>
                      ₹{parseFloat(activationResult.ledger?.resulting_balance || selectedPlan.creditAmount).toLocaleString('en-IN')}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', color: '#94A3B8' }}>Weekly Reservation Quota:</span>
                    <strong style={{ fontSize: '14px', color: '#38BDF8' }}>
                      {selectedPlan.weeklyQtyLimitKg} kg/week
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', color: '#94A3B8' }}>Status:</span>
                    <span style={{
                      background: 'rgba(34, 197, 94, 0.15)',
                      color: '#22C55E',
                      fontSize: '11px',
                      fontWeight: '800',
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      ACTIVE
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #1E293B' }}>
                    <span style={{ fontSize: '13px', color: '#94A3B8' }}>Active Expiry:</span>
                    <span style={{ fontSize: '13px', color: '#F8FAFC' }}>
                      {activationResult.subscription?.expires_at
                        ? new Date(activationResult.subscription.expires_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : `${selectedPlan.validityDays} days from today`}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <Link
                    href="/fish"
                    onClick={closeModal}
                    style={{
                      padding: '12px 20px',
                      background: '#0284C7',
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '700',
                      textAlign: 'center',
                      textDecoration: 'none'
                    }}
                  >
                    Browse Fresh Catch & Reserve &rarr;
                  </Link>

                  <button
                    onClick={closeModal}
                    style={{
                      padding: '12px 20px',
                      background: 'transparent',
                      color: '#94A3B8',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      border: '1px solid #334155',
                      cursor: 'pointer'
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
