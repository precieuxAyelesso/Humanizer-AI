import React from 'react';
import { ShieldAlert, FileText, ArrowLeft } from 'lucide-react';

export const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-brand-bg text-slate-800 p-6 md:p-12">
      <div className="max-w-4xl mx-auto bg-white/60 backdrop-blur-md p-8 md:p-12 rounded-3xl shadow-xl border border-slate-900/5">
        <a href="/" className="inline-flex items-center text-emerald-600 hover:text-emerald-700 font-semibold mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour à l'accueil
        </a>
        
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Politique de confidentialité</h1>
        </div>
        
        <div className="space-y-8 text-slate-600 leading-relaxed">
          <p className="text-sm font-medium text-slate-500">Dernière mise à jour : 15 août 2026</p>
          
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">1. Collecte des informations</h2>
            <p>Nous recueillons des informations lorsque vous vous inscrivez sur notre site, vous connectez à votre compte, et utilisez notre service Humanizer AI. Les informations recueillies incluent votre nom, votre adresse e-mail, et les textes que vous soumettez pour reformulation.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">2. Utilisation des informations</h2>
            <p>Toutes les informations que nous recueillons auprès de vous peuvent être utilisées pour :</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Personnaliser votre expérience et répondre à vos besoins individuels</li>
              <li>Améliorer notre site Web</li>
              <li>Améliorer le service client et vos besoins de prise en charge</li>
              <li>Vous contacter par e-mail</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">3. Confidentialité et sécurité</h2>
            <p>Nous sommes les seuls propriétaires des informations recueillies sur ce site. Vos informations personnelles ne seront pas vendues, échangées, transférées, ou données à une autre société pour n'importe quelle raison, sans votre consentement.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">4. Connexion avec Google</h2>
            <p>Si vous choisissez de vous connecter avec Google, nous accédons uniquement aux informations de base de votre profil (nom et adresse e-mail) nécessaires à la création et gestion de votre compte sur notre plateforme. Aucune donnée supplémentaire n'est extraite de votre compte Google.</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">5. Consentement</h2>
            <p>En utilisant notre site, vous consentez à notre politique de confidentialité.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-brand-bg text-slate-800 p-6 md:p-12">
      <div className="max-w-4xl mx-auto bg-white/60 backdrop-blur-md p-8 md:p-12 rounded-3xl shadow-xl border border-slate-900/5">
        <a href="/" className="inline-flex items-center text-emerald-600 hover:text-emerald-700 font-semibold mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour à l'accueil
        </a>
        
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
            <FileText className="w-8 h-8" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Conditions d'utilisation</h1>
        </div>
        
        <div className="space-y-8 text-slate-600 leading-relaxed">
          <p className="text-sm font-medium text-slate-500">Dernière mise à jour : 15 août 2026</p>
          
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">1. Acceptation des conditions</h2>
            <p>En accédant à ce site web (Humanizer AI), vous acceptez d'être lié par ces conditions d'utilisation, toutes les lois et réglementations applicables, et acceptez que vous êtes responsable du respect des lois locales applicables.</p>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">2. Utilisation du service</h2>
            <p>Le service Humanizer AI est fourni pour vous aider à reformuler et améliorer des textes. Vous acceptez de ne pas utiliser le service à des fins illégales ou non autorisées.</p>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">3. Clause de non-responsabilité</h2>
            <p>Les services et documents sur le site web de Humanizer AI sont fournis "tels quels". Humanizer AI ne donne aucune garantie, expresse ou implicite, et décline et annule par la présente toutes les autres garanties concernant l'exactitude des textes générés.</p>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">4. Limitations</h2>
            <p>En aucun cas Humanizer AI ou ses fournisseurs ne seront responsables de tout dommage découlant de l'utilisation ou de l'incapacité d'utiliser les services de Humanizer AI.</p>
          </section>
          
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800">5. Modifications des conditions</h2>
            <p>Humanizer AI peut réviser ces conditions d'utilisation de son site web à tout moment sans préavis. En utilisant ce site web, vous acceptez d'être lié par la version alors en vigueur de ces conditions d'utilisation.</p>
          </section>
        </div>
      </div>
    </div>
  );
};
