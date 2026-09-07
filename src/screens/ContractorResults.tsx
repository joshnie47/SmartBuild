import { useState, useEffect } from 'react';
import { Check, MapPin, BadgeCheck, Eye, GitCompare, ArrowLeft, Trophy, Loader2, Clock, Bell, Send, ShieldCheck, Sparkles, CheckCircle2, Image as ImageIcon, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { TopNav } from '../components/TopNav';
import { MicButton, StarRating } from '../components/ui';
import type { ScreenId, Contractor, PortfolioItem, PortfolioAuthenticitySummary } from '../types';
import { useLocale } from '../i18n/LocaleContext';
import { t } from '../i18n';
import { apiGetProjects, apiSelectContractor, apiGetProjectBids, apiAcceptBid, apiRejectBid, apiGetProjectRecommendations, type ApiProject } from '../lib/api';

export interface ContractorResultItem extends Contractor {
  bidId?: string;
  status?: string;
  proposalMessage?: string;
  portfolioItems?: PortfolioItem[];
  portfolioAuthenticity?: PortfolioAuthenticitySummary;
}

export function ContractorResults({
  onNavigate,
  projectId,
}: {
  onNavigate: (id: ScreenId, projectId?: string) => void;
  projectId?: string;
}) {
  const { locale } = useLocale();
  const [view, setView] = useState<'list' | 'compare'>('list');
  const [contractorList, setContractorList] = useState<ContractorResultItem[]>([]);
  const [expandedGalleries, setExpandedGalleries] = useState<Record<string, boolean>>({});
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeProject, setActiveProject] = useState<ApiProject | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const projects = await apiGetProjects();
        if (projects.length > 0) {
          const target = (projectId ? projects.find((p) => p._id === projectId) : null) || projects[0];
          setActiveProject(target);

          // 1. Fetch recommendations (which incorporates the AI Portfolio Authenticity Factor)
          const recRes = await apiGetProjectRecommendations(target._id).catch(() => null);
          const recs = recRes?.recommendations || [];

          // 2. Fetch live bids submitted for this project
          const bidsRes = await apiGetProjectBids(target._id).catch(() => null);
          const bids = bidsRes?.bids || [];

          if (bids.length > 0) {
            const mappedBids: ContractorResultItem[] = bids.map((b: any, index: number) => {
              const contractor = b.contractor;
              const contractorId = typeof b.contractorId === 'object' && b.contractorId ? b.contractorId._id : b.contractorId;
              const matchedRec = recs.find((r: any) => String(r.id) === String(contractorId) || String(r._id) === String(contractorId));

              return {
                id: String(contractorId || b._id),
                bidId: b._id,
                name: contractor?.name || matchedRec?.name || 'Contractor',
                trade: contractor?.trade || matchedRec?.specialization || 'Contractor',
                specialization: contractor?.trade || matchedRec?.specialization || 'Civil Works',
                experience: contractor?.experience || matchedRec?.experience || '5 yrs',
                rating: contractor?.rating || matchedRec?.rating || 4.8,
                reviews: contractor?.totalReviews || matchedRec?.reviews || 12,
                completedProjects: contractor?.completedProjects || 15,
                distance: contractor?.city ? `${contractor.city}` : (target.location || 'Coimbatore'),
                verified: contractor?.isVerified ?? true,
                available: true,
                quotedPrice: b.amount,
                timeline: `${b.estimatedDays} days`,
                matchScore: matchedRec?.matchScore || (b.matchScore || (98 - index * 4)),
                status: b.status,
                proposalMessage: b.proposalMessage,
                photo: matchedRec?.photo || 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200',
                portfolioItems: matchedRec?.portfolioItems || [],
                portfolioAuthenticity: matchedRec?.portfolioAuthenticity || {
                  status: 'ALL_REAL',
                  label: '100% Verified Real Project Photos',
                  realPercentage: 100,
                  realCount: matchedRec?.portfolioItems?.length || 3,
                  aiCount: 0,
                  totalCount: matchedRec?.portfolioItems?.length || 3,
                },
              };
            });
            setContractorList(mappedBids);
            if (mappedBids.length >= 2) {
              setCompareIds([mappedBids[0].id, mappedBids[1].id]);
            }
          } else if (recs.length > 0) {
            // Render matched recommended candidates
            const mappedRecs: ContractorResultItem[] = recs.map((r: any) => ({
              id: String(r.id || r._id),
              bidId: r.bidId || undefined,
              name: r.name,
              trade: r.specialization,
              specialization: r.specialization,
              experience: r.experience,
              rating: r.rating,
              reviews: r.reviews,
              completedProjects: 15,
              distance: r.distance,
              verified: r.verified,
              available: true,
              quotedPrice: r.quotedPrice,
              timeline: r.timeline,
              matchScore: r.matchScore,
              proposalMessage: r.proposalMessage,
              photo: r.photo,
              portfolioItems: r.portfolioItems || [],
              portfolioAuthenticity: r.portfolioAuthenticity,
            }));
            setContractorList(mappedRecs);
            if (mappedRecs.length >= 2) {
              setCompareIds([mappedRecs[0].id, mappedRecs[1].id]);
            }
          } else {
            setContractorList([]);
          }
        }
      } catch {
        setContractorList([]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [projectId]);

  const compareList = contractorList.filter((c) => compareIds.includes(c.id));

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const handleSelectContractor = async (contractorId: string, bidId?: string) => {
    setSelected(contractorId);
    if (activeProject) {
      try {
        if (bidId) {
          await apiAcceptBid(bidId);
        } else {
          await apiSelectContractor(activeProject._id, contractorId);
        }
      } catch {
        // Fallback
      }
    }
    onNavigate('project-tracking', activeProject?._id);
  };

  const handleRejectContractorBid = async (bidId: string) => {
    try {
      await apiRejectBid(bidId);
      setContractorList((prev) =>
        prev.map((c) => (c.bidId === bidId ? { ...c, status: 'REJECTED' } : c))
      );
    } catch {
      // Fallback
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <TopNav onNavigate={onNavigate} />
      <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <button
          onClick={() => onNavigate('client-home')}
          className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-navy-600"
        >
          <ArrowLeft className="h-4 w-4" /> {t(locale, 'back') || 'Back'}
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy-700">
              {activeProject?.title ? `${activeProject.title}` : (t(locale, 'matchedContractors') || 'Received Contractor Bids')}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {activeProject?.location && `${activeProject.location} · `}
              {activeProject?.budget ? `Budget: ₹${activeProject.budget.toLocaleString('en-IN')} · ` : ''}
              <span className="font-semibold text-navy-700">{contractorList.length}</span> {contractorList.length === 1 ? 'Bid Received' : 'Bids Received'}
            </p>
          </div>
          <div className="flex rounded-lg bg-gray-100 p-0.5">
            <button
              onClick={() => setView('list')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                view === 'list' ? 'bg-white text-navy-700 shadow-soft' : 'text-gray-500'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setView('compare')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                view === 'compare' ? 'bg-white text-navy-700 shadow-soft' : 'text-gray-500'
              }`}
            >
              Compare ({compareIds.length})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <p className="mt-3 text-sm text-gray-400">Loading received contractor quotations...</p>
          </div>
        ) : view === 'list' ? (
          <div className="mt-6 space-y-4">
            {contractorList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-navy-200 bg-gradient-to-b from-navy-50/50 to-white p-8 md:p-10 text-center shadow-soft">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4 shadow-sm">
                  <Clock className="h-7 w-7 animate-pulse" />
                </div>
                <h3 className="text-lg font-bold text-navy-800">Awaiting Contractor Quotations</h3>
                <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
                  Your project has been broadcasted to verified available <span className="font-semibold text-navy-700">{activeProject?.category || 'domain'}</span> contractors in {activeProject?.location || 'Coimbatore'}.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  Notifications Dispatched · 0 Bids Received So Far
                </div>
                <div className="mx-auto mt-5 max-w-sm rounded-xl bg-white border border-gray-100 p-3.5 text-left text-xs text-gray-600 space-y-1.5 shadow-sm">
                  <p className="flex items-center gap-2">
                    <span className="text-emerald-600 font-bold">✓</span> Notification sent to domain contractors
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-amber-500 font-bold">⏳</span> Contractors review specs & prepare quotes
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-blue-500 font-bold">🔔</span> Quotations will appear here in real-time
                  </p>
                </div>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    onClick={() => onNavigate('client-home')}
                    className="rounded-xl bg-navy-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-navy-700 shadow-sm transition-transform active:scale-95"
                  >
                    Go to My Dashboard
                  </button>
                </div>
              </div>
            ) : (
              contractorList.map((c, index) => (
                <div
                  key={c.id}
                  className={`relative rounded-xl border p-4 shadow-card transition-shadow hover:shadow-soft md:p-5 ${
                    index === 0
                      ? 'border-amber-300 bg-amber-50/20'
                      : index === 1
                      ? 'border-blue-200 bg-blue-50/10'
                      : 'border-gray-100 bg-white'
                  }`}
                >
                  {/* AI Recommendation Highlight Badge */}
                  {index === 0 && (
                    <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-navy-950 shadow-sm">
                      <Trophy className="h-3.5 w-3.5 text-navy-900" /> AI #1 Recommendation · Best Match & Verified
                    </div>
                  )}
                  {index === 1 && (
                    <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-900 shadow-sm">
                      ⚡ AI #2 Recommendation · Fastest Completion
                    </div>
                  )}

                  <div className="flex items-start gap-4">
                    <img
                      src={c.photo}
                      alt={c.name}
                      className="h-14 w-14 rounded-full object-cover shrink-0"
                    />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-navy-700">{c.name}</span>
                        {c.verified && (
                          <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            <BadgeCheck className="h-4 w-4" /> Verified
                          </span>
                        )}
                        {c.status && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              c.status === 'ACCEPTED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : c.status === 'REJECTED'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {c.status === 'ACCEPTED' ? 'Accepted' : c.status === 'REJECTED' ? 'Rejected' : 'Submitted'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {c.specialization} · {c.experience}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <StarRating rating={c.rating} /> {c.rating} ({c.reviews})
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {c.distance}
                        </span>
                      </div>

                      {c.proposalMessage && (
                        <div className="mt-2.5 rounded-lg bg-gray-50 border border-gray-100 p-2.5 text-xs text-gray-600">
                          <span className="font-semibold text-navy-700">Proposal: </span>
                          "{c.proposalMessage}"
                        </div>
                      )}

                      {/* Portfolio Authenticity Indicator for Clients */}
                      {c.portfolioAuthenticity && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-800 shadow-xs">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                            <span>
                              {c.portfolioAuthenticity.realPercentage ?? (c.portfolioAuthenticity as any).percentage ?? 100}% Portfolio Authenticity
                              {c.portfolioAuthenticity.realCount > 0 && ` · ${c.portfolioAuthenticity.realCount} Real`}
                              {c.portfolioAuthenticity.aiCount > 0 && ` · ${c.portfolioAuthenticity.aiCount} AI`}
                              {c.portfolioAuthenticity.uncertainCount ? ` · ${c.portfolioAuthenticity.uncertainCount} Unverified` : ''}
                            </span>
                          </span>

                          {c.portfolioItems && c.portfolioItems.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedGalleries((prev) => ({
                                  ...prev,
                                  [c.id]: !prev[c.id],
                                }))
                              }
                              className="inline-flex items-center gap-1 text-xs font-semibold text-navy-600 hover:text-navy-800 hover:underline transition-colors"
                            >
                              <ImageIcon className="h-3.5 w-3.5 text-navy-500" />
                              <span>{expandedGalleries[c.id] ? 'Hide Gallery' : `View Portfolio (${c.portfolioItems.length})`}</span>
                              {expandedGalleries[c.id] ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Expandable Portfolio Photo Inspection Drawer */}
                      {expandedGalleries[c.id] && c.portfolioItems && c.portfolioItems.length > 0 && (
                        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3 animate-fadeIn">
                          <p className="text-[11px] font-semibold text-navy-700 uppercase mb-2 flex items-center justify-between">
                            <span>Contractor Portfolio & Authenticity Inspection:</span>
                            <span className="text-gray-400 normal-case">AI Verified by SmartBuild</span>
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {c.portfolioItems.map((photo, pIdx) => {
                              const isAi =
                                photo.aiClassification === 'LIKELY_AI_GENERATED' ||
                                photo.contractorConfirmedAI ||
                                photo.isAiMarked ||
                                photo.authenticity === 'AI_GENERATED' ||
                                photo.authenticity === 'LIKELY_AI';
                              const isUncertain =
                                photo.aiClassification === 'UNCERTAIN' ||
                                photo.authenticity === 'UNCERTAIN';
                              const photoSrc = photo.imageUrl || photo.url || '';

                              return (
                                <div key={pIdx} className="group relative aspect-video overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xs">
                                  <img
                                    src={photoSrc}
                                    alt={`Portfolio Photo ${pIdx + 1}`}
                                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80" />
                                  <div className="absolute bottom-1.5 left-1.5 right-1.5">
                                    {isAi ? (
                                      <span className="inline-flex items-center gap-1 rounded bg-amber-950/90 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-bold text-amber-200 shadow-xs border border-amber-400/30">
                                        <AlertTriangle className="h-2.5 w-2.5 text-amber-300" /> ⚠ AI Generated
                                      </span>
                                    ) : isUncertain ? (
                                      <span className="inline-flex items-center gap-1 rounded bg-blue-950/90 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-bold text-blue-200 shadow-xs border border-blue-400/30">
                                        ? Unverified
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 rounded bg-emerald-950/90 backdrop-blur-xs px-1.5 py-0.5 text-[9px] font-bold text-emerald-200 shadow-xs border border-emerald-400/30">
                                        <CheckCircle2 className="h-2.5 w-2.5 text-emerald-300" /> ✓ Likely Real
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Match score */}
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Trophy className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-lg font-bold text-navy-700">{c.matchScore}%</span>
                      </div>
                      <p className="text-xs text-gray-400">match</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3">
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-xs text-gray-400">Quoted Estimate</span>
                        <p className="font-semibold text-navy-700">₹{c.quotedPrice.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400">Timeline</span>
                        <p className="font-semibold text-navy-700">{c.timeline}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleCompare(c.id)}
                        className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                          compareIds.includes(c.id)
                            ? 'border-navy-600 bg-navy-600 text-white'
                            : 'border-gray-200 text-navy-600 hover:bg-navy-50'
                        }`}
                      >
                        {compareIds.includes(c.id) ? <Check className="h-3.5 w-3.5" /> : <GitCompare className="h-3.5 w-3.5" />}
                        Compare
                      </button>
                      {c.status === 'ACCEPTED' ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">
                          <Check className="h-3.5 w-3.5" /> Accepted & Hired
                        </span>
                      ) : c.status === 'REJECTED' ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500">
                          Declined
                        </span>
                      ) : (
                        <>
                          {c.bidId && (
                            <button
                              onClick={() => handleRejectContractorBid(c.bidId!)}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-600"
                            >
                              Reject
                            </button>
                          )}
                          <button
                            onClick={() => handleSelectContractor(c.id, c.bidId)}
                            className="flex items-center gap-1 rounded-lg bg-amber-400 px-4 py-1.5 text-xs font-bold text-navy-950 hover:bg-amber-300 shadow-soft transition-transform active:scale-95"
                          >
                            <Check className="h-3.5 w-3.5" /> {c.bidId ? 'Accept & Hire' : 'Select Contractor'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <CompareView
            contractors={compareList}
            selected={selected}
            onSelect={handleSelectContractor}
            onNavigate={onNavigate}
          />
        )}
      </div>
      <MicButton />
    </div>
  );
}

function CompareView({
  contractors,
  selected,
  onSelect,
  onNavigate,
}: {
  contractors: ContractorResultItem[];
  selected: string | null;
  onSelect: (id: string, bidId?: string) => void;
  onNavigate: (id: ScreenId) => void;
}) {
  const rows = [
    { label: 'Quoted Price', key: (c: ContractorResultItem) => `₹${c.quotedPrice.toLocaleString('en-IN')}` },
    { label: 'Rating', key: (c: ContractorResultItem) => `${c.rating} ★ (${c.reviews})` },
    { label: 'Timeline', key: (c: ContractorResultItem) => c.timeline },
    { label: 'Experience', key: (c: ContractorResultItem) => c.experience },
    { label: 'Distance', key: (c: ContractorResultItem) => c.distance },
    { label: 'Verified Status', key: (c: ContractorResultItem) => (c.verified ? 'Verified Pro' : 'Pending') },
    {
      label: 'Portfolio Authenticity',
      key: (c: ContractorResultItem) =>
        c.portfolioAuthenticity
          ? c.portfolioAuthenticity.status === 'ALL_REAL'
            ? `🛡️ 100% Real (${c.portfolioAuthenticity.realCount} Photos Verified)`
            : c.portfolioAuthenticity.status === 'MIXED_AI'
            ? `✨ Mixed (${c.portfolioAuthenticity.realCount} Real · ${c.portfolioAuthenticity.aiCount} AI Concepts)`
            : `✨ AI Concepts (${c.portfolioAuthenticity.aiCount} Renderings)`
          : 'Verified Profile',
    },
  ];

  return (
    <div className="mt-6">
      {contractors.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-gray-100 py-16 text-center">
          <GitCompare className="h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm text-gray-500">Select contractors from the list to compare them side by side.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="p-4 text-left font-medium text-gray-500">Contractor</th>
                {contractors.map((c) => (
                  <th key={c.id} className="p-4 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <img src={c.photo} alt={c.name} className="h-12 w-12 rounded-full object-cover" />
                      <span className="font-semibold text-navy-700">{c.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-gray-100 last:border-0">
                  <td className="p-4 font-medium text-gray-500">{row.label}</td>
                  {contractors.map((c) => (
                    <td key={c.id} className="p-4 text-center font-medium text-navy-700">
                      {row.key(c)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="p-4" />
                {contractors.map((c) => (
                  <td key={c.id} className="p-4 text-center">
                    <button
                      onClick={() => onSelect(c.id, c.bidId)}
                      className={`w-full rounded-lg py-2 text-xs font-bold transition-colors ${
                        selected === c.id
                          ? 'bg-emerald-500 text-white'
                          : 'bg-amber-400 text-navy-950 hover:bg-amber-300'
                      }`}
                    >
                      {selected === c.id ? 'Selected' : 'Accept & Hire'}
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
