# Ανεξάρτητος έλεγχος με numpy (δεν μοιράζεται κώδικα με το engine.js)
import numpy as np, json, subprocess
sy=np.array([[0,-1j],[1j,0]]); YY=np.kron(sy,sy)
def prep(e,p):
    plus=np.full((2,2),.5); part=np.diag([1-p,p]); r=np.kron(plus,part)
    th=np.pi*e; Ry=np.array([[np.cos(th/2),-np.sin(th/2)],[np.sin(th/2),np.cos(th/2)]])
    U=np.block([[np.eye(2),np.zeros((2,2))],[np.zeros((2,2)),Ry]]); return U@r@U.conj().T
def conc(r):
    R=r@YY@r.conj()@YY; ev=np.sqrt(np.clip(np.sort(np.linalg.eigvals(R).real)[::-1],0,None))
    return max(0,ev[0]-ev[1]-ev[2]-ev[3])
def local_s(r,q,t,J,T2,T2s,tau,echo,nu=0):
    # σ^- του qubit q, μερικό ίχνος και χρονική εξέλιξη με διαγώνιο H (περιστρεφόμενο σύστημα)
    sm=np.array([[0,1],[0,0]])  # |0><1| : Tr[ρ σ] = ρ_10 ... παίρνουμε ρ_{0,1} του τοπικού
    out=0
    for b in (0,1):
        i,j=((0*2+b),(1*2+b)) if q==0 else ((b*2+0),(b*2+1))
        c=r[i,j]; f=nu+J*(0.5-b)
        if echo and t>tau: c=np.conj(c); te=t-2*tau
        else: te=t
        out+=2*c*np.exp(2j*np.pi*f*te)
    return out*np.exp(-t/T2)*np.exp(-abs(te)*(1/T2s-1/T2))
res=[]
for e,p in [(0,0),(1,0),(.5,0),(1,.25),(.3,.1),(.8,.4)]:
    r=prep(e,p); res.append(('C',e,p,conc(r),(1-2*p)*np.sin(np.pi*e/2)))
js=json.loads(subprocess.check_output(['node','-e','const E=require("./src/engine.js");console.log(JSON.stringify([[0,0],[1,0],[.5,0],[1,.25],[.3,.1],[.8,.4]].map(([e,p])=>E.prepare(e,p).C)))']))
print('concurrence numpy vs JS vs τύπος:')
for (k,e,p,cn,cf),cj in zip(res,js): print(f'  e={e} p={p}: numpy {cn:.9f}  JS {cj:.9f}  τύπος {cf:.9f}')
# Bell: τοπικά ίχνη
r=prep(1,0); print('Bell ρ_q0 =',np.round(np.trace(r.reshape(2,2,2,2),axis1=1,axis2=3).real,12).tolist())
# ηχώ με ανεξάρτητη σάρωση
r=prep(0,0); ts=np.linspace(0.031,0.2,170001); a=np.abs([local_s(r,0,t,7,0.4,0.005,0.03,True,3) for t in ts])
print('ηχώ: t_max =',ts[a.argmax()],' ύψος =',a.max(),' e^{-2τ/T2} =',np.exp(-0.06/0.4))
# Studie II
print('Studie II: cents/βήμα =',1200*np.log2(5)/25,' f80 =',100*5**(80/25))
# φίλτρο: αναλυτικό |H(jωc)| k=0 και πόλοι για k=4
print('|H(jωc)|, k=0 =',abs(1/((1+1j)**4)),' πόλοι k=4 στο Re=0:', np.round(np.roots(np.poly1d([1,4,6,4,1+4])),6).tolist())
