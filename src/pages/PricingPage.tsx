import { useState } from 'react';
import { CheckIcon, SparklesIcon, StarIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';

interface PricingTier {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  color: string;
  gradient: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

const PRICING_TIERS: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '₹0',
    period: 'forever',
    description: 'Perfect for getting started',
    color: 'from-slate-500 to-slate-600',
    gradient: 'from-slate-50 to-slate-100',
    features: [
      'Basic Dashboard',
      'Up to 3 Projects',
      'Basic Tasks',
      'Client Management (5 clients)',
      '5 Quotations/month',
      '5 Invoices/month',
      'Basic Inventory',
      'Stock Check',
      'Email Support',
    ],
    cta: 'Get Started',
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '₹999',
    period: '/month',
    description: 'For growing businesses',
    color: 'from-blue-500 to-blue-600',
    gradient: 'from-blue-50 to-blue-100',
    features: [
      'Everything in Free',
      'Unlimited Projects',
      'Full Tasks & Approvals',
      'Unlimited Clients',
      'Site Visits & Reports',
      'Client Communication',
      'Unlimited Quotations',
      'Unlimited Invoices',
      'Proforma Invoices',
      'Full Inventory Management',
      'Material Inward/Outward',
      'Stock Transfer',
      'Warehouses',
      'Basic Delivery Challan',
      'Full Reports',
      'Print Settings',
      'Document Settings',
      'Priority Email Support',
    ],
    cta: 'Start Free Trial',
  },
  {
    id: 'elite',
    name: 'Elite',
    price: '₹2,499',
    period: '/month',
    description: 'For scaling teams',
    color: 'from-purple-500 to-purple-600',
    gradient: 'from-purple-50 to-purple-100',
    highlighted: true,
    features: [
      'Everything in Premium',
      'Sub-Contractor Management',
      'Work Orders',
      'Attendance & Daily Logs',
      'Subcontractor Payments',
      'Subcontractor Invoices',
      'Subcontractor Documents',
      'Full Delivery Challan (NB-DC)',
      'DC Consolidation',
      'BOQ Management',
      'Issue Tracking',
      'Template Settings',
      'Quick Quote',
      'Organisation Settings',
      'Access Control',
      'Discount Settings',
      'Priority Phone Support',
    ],
    cta: 'Start Free Trial',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: 'contact us',
    description: 'For large organizations',
    color: 'from-amber-500 to-amber-600',
    gradient: 'from-amber-50 to-amber-100',
    features: [
      'Everything in Elite',
      'Custom Branding',
      'API Access',
      'Priority Support (24/7)',
      'Custom Integrations',
      'Unlimited Storage',
      'Advanced Analytics',
      'Multi-organisation Support',
      'Custom Workflows',
      'White-label Options',
      'Dedicated Account Manager',
      'SLA Guarantee',
      'On-site Training',
    ],
    cta: 'Contact Sales',
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-[clamp(3rem,8vw,6rem)]">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-5 py-2 rounded-full text-sm font-medium mb-8">
              <SparklesIcon className="w-4 h-4" />
              <span>Simple, transparent pricing</span>
            </div>
            <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-bold text-slate-900 mb-5 tracking-tight">
              Choose your plan
            </h1>
            <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Start free and scale as you grow. No hidden fees, cancel anytime.
            </p>

            {/* Toggle */}
            <div className="flex items-center justify-center gap-5 mt-12">
              <span className={`text-sm font-medium ${!annual ? 'text-slate-900' : 'text-slate-500'}`}>
                Monthly
              </span>
              <button
                onClick={() => setAnnual(!annual)}
                className={`relative w-14 h-7 rounded-full transition-colors ${
                  annual ? 'bg-blue-500' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    annual ? 'translate-x-7' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${annual ? 'text-slate-900' : 'text-slate-500'}`}>
                Annual <span className="text-green-600 font-semibold">(Save 20%)</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-[clamp(3rem,8vw,5rem)]">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {PRICING_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`relative rounded-2xl p-[clamp(1.5rem,4vw,2.5rem)] transition-all duration-300 hover:scale-105 ${
                tier.highlighted
                  ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-2xl shadow-purple-500/25'
                  : 'bg-white border border-slate-200 shadow-sm hover:shadow-lg'
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-white px-4 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                    <StarIcon className="w-4 h-4" />
                    <span>Most Popular</span>
                  </div>
                </div>
              )}

              <div className="text-center mb-10">
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5 bg-gradient-to-br ${tier.color} text-white`}>
                  {tier.id === 'free' && <SparklesIcon className="w-7 h-7" />}
                  {tier.id === 'premium' && <StarIcon className="w-7 h-7" />}
                  {tier.id === 'elite' && <BuildingOfficeIcon className="w-7 h-7" />}
                  {tier.id === 'enterprise' && <SparklesIcon className="w-7 h-7" />}
                </div>
                <h3 className={`text-2xl font-bold mb-3 ${tier.highlighted ? 'text-white' : 'text-slate-900'}`}>
                  {tier.name}
                </h3>
                <p className={`text-sm ${tier.highlighted ? 'text-purple-100' : 'text-slate-500'}`}>
                  {tier.description}
                </p>
              </div>

              <div className="text-center mb-10">
                <div className={`text-[clamp(2rem,5vw,2.75rem)] font-bold ${tier.highlighted ? 'text-white' : 'text-slate-900'}`}>
                  {tier.price}
                </div>
                <div className={`text-sm ${tier.highlighted ? 'text-purple-100' : 'text-slate-500'}`}>
                  {tier.period}
                </div>
              </div>

              <ul className="space-y-4 mb-10">
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckIcon
                      className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        tier.highlighted ? 'text-purple-200' : 'text-green-500'
                      }`}
                    />
                    <span className={`text-sm leading-relaxed ${tier.highlighted ? 'text-purple-100' : 'text-slate-600'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full py-4 px-6 rounded-xl font-semibold transition-all ${
                  tier.highlighted
                    ? 'bg-white text-purple-600 hover:bg-purple-50'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                }`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-[clamp(3rem,8vw,5rem)]">
        <h2 className="text-[clamp(1.75rem,4vw,2.25rem)] font-bold text-slate-900 text-center mb-16 tracking-tight">
          Frequently Asked Questions
        </h2>
        <div className="space-y-5">
          {[
            {
              q: 'Can I change plans anytime?',
              a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we\'ll prorate your billing.',
            },
            {
              q: 'What payment methods do you accept?',
              a: 'We accept all major credit cards, debit cards, and UPI payments. Enterprise plans can also pay via bank transfer.',
            },
            {
              q: 'Is there a free trial?',
              a: 'Yes! Premium and Elite plans come with a 14-day free trial. No credit card required to start.',
            },
            {
              q: 'What happens if I exceed my limits?',
              a: 'We\'ll notify you when you\'re approaching your limits. You can upgrade anytime to continue using all features.',
            },
            {
              q: 'Do you offer refunds?',
              a: 'Yes, we offer a 30-day money-back guarantee. If you\'re not satisfied, contact us for a full refund.',
            },
          ].map((faq, index) => (
            <div key={index} className="bg-white rounded-2xl p-7 border border-slate-200">
              <h3 className="font-semibold text-slate-900 mb-3 text-base">{faq.q}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-[clamp(3rem,8vw,5rem)] text-center">
          <h2 className="text-[clamp(1.75rem,4vw,2.25rem)] font-bold text-white mb-5 tracking-tight">
            Ready to get started?
          </h2>
          <p className="text-blue-100 mb-10 text-lg leading-relaxed max-w-2xl mx-auto">
            Join thousands of businesses already using our platform to streamline their operations.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-white text-blue-600 px-10 py-4 rounded-xl font-semibold hover:bg-blue-50 transition-colors">
              Start Free Trial
            </button>
            <button className="bg-transparent border-2 border-white text-white px-10 py-4 rounded-xl font-semibold hover:bg-white/10 transition-colors">
              Contact Sales
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
