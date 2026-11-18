(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[453],{8200:function(e,r,t){Promise.resolve().then(t.bind(t,3045))},3045:function(e,r,t){"use strict";t.r(r),t.d(r,{default:function(){return u}});var n=t(7437),s=t(2265),a=t(6463),o=t(3274);function u(){let e=(0,a.useRouter)(),r=(0,a.useSearchParams)();return(0,s.useEffect)(()=>{(()=>{try{var t;let n=r.get("data");if(!n){e.push("/");return}let s=Uint8Array.from(atob(n),e=>e.charCodeAt(0)),a=new TextDecoder().decode(s),o=JSON.parse(a);window.localStorage.setItem("token",o.token),window.localStorage.setItem("refreshToken",o.refreshToken),window.localStorage.setItem("user",JSON.stringify(o.user)),e.push((null===(t=o.user)||void 0===t?void 0:t.role)==="teacher"?"/promotions":"/my-projects")}catch(r){e.push("/")}})()},[e,r]),(0,n.jsx)("div",{className:"min-h-screen flex items-center justify-center bg-background",children:(0,n.jsxs)("div",{className:"text-center space-y-4",children:[(0,n.jsx)(o.Z,{className:"h-12 w-12 animate-spin mx-auto text-primary","aria-hidden":"true"}),(0,n.jsx)("h2",{className:"text-xl font-semibold",children:"Connexion r\xe9ussie !"}),(0,n.jsx)("p",{className:"text-muted-foreground",children:"Redirection en cours…"})]})})}},8030:function(e,r,t){"use strict";t.d(r,{Z:function(){return i}});var n=t(2265);/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let s=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),a=function(){for(var e=arguments.length,r=Array(e),t=0;t<e;t++)r[t]=arguments[t];return r.filter((e,r,t)=>!!e&&""!==e.trim()&&t.indexOf(e)===r).join(" ").trim()};/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var o={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let u=(0,n.forwardRef)((e,r)=>{let{color:t="currentColor",size:s=24,strokeWidth:u=2,absoluteStrokeWidth:i,className:c="",children:l,iconNode:d,...h}=e;return(0,n.createElement)("svg",{ref:r,...o,width:s,height:s,stroke:t,strokeWidth:i?24*Number(u)/Number(s):u,className:a("lucide",c),...h},[...d.map(e=>{let[r,t]=e;return(0,n.createElement)(r,t)}),...Array.isArray(l)?l:[l]])}),i=(e,r)=>{let t=(0,n.forwardRef)((t,o)=>{let{className:i,...c}=t;return(0,n.createElement)(u,{ref:o,iconNode:r,className:a("lucide-".concat(s(e)),i),...c})});return t.displayName="".concat(e),t}},3274:function(e,r,t){"use strict";t.d(r,{Z:function(){return n}});/**
 * @license lucide-react v0.454.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */let n=(0,t(8030).Z)("LoaderCircle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]])},6463:function(e,r,t){"use strict";var n=t(1169);t.o(n,"usePathname")&&t.d(r,{usePathname:function(){return n.usePathname}}),t.o(n,"useRouter")&&t.d(r,{useRouter:function(){return n.useRouter}}),t.o(n,"useSearchParams")&&t.d(r,{useSearchParams:function(){return n.useSearchParams}})}},function(e){e.O(0,[971,23,744],function(){return e(e.s=8200)}),_N_E=e.O()}]);