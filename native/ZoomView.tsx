/** Zoom da ilustração: pinça (2 dedos), arrastar, toque duplo e botões +, − e AJUSTAR.
 * Fica dentro de um <Modal>, então aparece acima do modo execução e da janela de edição. */
import React,{useRef,useState} from 'react';
import {Image,ImageSourcePropType,LayoutChangeEvent,Modal,PanResponder,Pressable,StyleSheet,Text,View} from 'react-native';

type T={s:number;x:number;y:number};
const MAX=6;
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));

export default function ZoomView({source,label,onClose}:{source:ImageSourcePropType;label:string;onClose:()=>void}){
 const [t,setT]=useState<T>({s:1,x:0,y:0});
 const tr=useRef<T>(t);const stage=useRef({w:0,h:0});
 const g=useRef({mode:'none' as 'none'|'pan'|'pinch',s:1,x:0,y:0,d:1,mx:0,my:0,t0:0,moved:false,lastTap:0});
 const guess=(()=>{try{const r=(Image as any).resolveAssetSource?.(source);return r?.width&&r?.height?r.width/r.height:0.75}catch{return 0.75}})();
 const ratioRef=useRef(guess);
 const base=()=>{const {w,h}=stage.current,ratio=ratioRef.current;if(!w||!h)return {bw:0,bh:0};return ratio>w/h?{bw:w,bh:w/ratio}:{bw:h*ratio,bh:h}};
 const apply=(n:T)=>{const {w,h}=stage.current,{bw,bh}=base();const mx=Math.max(0,(bw*n.s-w)/2),my=Math.max(0,(bh*n.s-h)/2);const v={s:clamp(n.s,1,MAX),x:n.s<=1?0:clamp(n.x,-mx,mx),y:n.s<=1?0:clamp(n.y,-my,my)};tr.current=v;setT(v)};
 const zoomBy=(k:number)=>apply({...tr.current,s:tr.current.s*k});
 const pan=useRef(PanResponder.create({
  onStartShouldSetPanResponder:()=>true,onMoveShouldSetPanResponder:()=>true,
  onPanResponderGrant:(e)=>{const ts=e.nativeEvent.touches,c=g.current;c.s=tr.current.s;c.x=tr.current.x;c.y=tr.current.y;c.t0=Date.now();c.moved=false;if(ts.length>=2){c.mode='pinch';c.d=Math.hypot(ts[0].pageX-ts[1].pageX,ts[0].pageY-ts[1].pageY)||1;c.mx=(ts[0].pageX+ts[1].pageX)/2;c.my=(ts[0].pageY+ts[1].pageY)/2}else c.mode='pan'},
  onPanResponderMove:(e,gs)=>{const ts=e.nativeEvent.touches,c=g.current;
   if(ts.length>=2){if(c.mode!=='pinch'){c.mode='pinch';c.s=tr.current.s;c.x=tr.current.x;c.y=tr.current.y;c.d=Math.hypot(ts[0].pageX-ts[1].pageX,ts[0].pageY-ts[1].pageY)||1;c.mx=(ts[0].pageX+ts[1].pageX)/2;c.my=(ts[0].pageY+ts[1].pageY)/2}
    const d=Math.hypot(ts[0].pageX-ts[1].pageX,ts[0].pageY-ts[1].pageY)||1,mx=(ts[0].pageX+ts[1].pageX)/2,my=(ts[0].pageY+ts[1].pageY)/2;c.moved=true;apply({s:c.s*d/c.d,x:c.x+(mx-c.mx),y:c.y+(my-c.my)});return}
   if(Math.hypot(gs.dx,gs.dy)>8)c.moved=true;if(c.mode==='pan'&&tr.current.s>1)apply({s:tr.current.s,x:c.x+gs.dx,y:c.y+gs.dy})},
  onPanResponderRelease:()=>{const c=g.current,now=Date.now();if(!c.moved&&now-c.t0<300){if(now-c.lastTap<320){apply(tr.current.s>1.05?{s:1,x:0,y:0}:{s:2.5,x:0,y:0});c.lastTap=0}else c.lastTap=now}c.mode='none'},
 })).current;
 const onLayout=(e:LayoutChangeEvent)=>{stage.current={w:e.nativeEvent.layout.width,h:e.nativeEvent.layout.height}};
 return <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
  <View style={Z.root} accessibilityViewIsModal accessibilityLabel="Ilustração ampliada">
   <View style={Z.stage} onLayout={onLayout} {...pan.panHandlers}>
    <Image source={source} resizeMode="contain" onLoad={(e:any)=>{const s=e?.nativeEvent?.source;if(s?.width&&s?.height)ratioRef.current=s.width/s.height}} accessibilityLabel={label} style={[Z.img,{transform:[{translateX:t.x},{translateY:t.y},{scale:t.s}]}]}/>
   </View>
   <View style={Z.bar}>
    <Pressable accessibilityRole="button" accessibilityLabel="Diminuir zoom" onPress={()=>zoomBy(1/1.5)} style={Z.btn}><Text style={Z.btnText}>−</Text></Pressable>
    <Text accessibilityLiveRegion="polite" accessibilityLabel={`Zoom ${Math.round(t.s*100)} por cento`} style={Z.pct}>{Math.round(t.s*100)}%</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Aumentar zoom" onPress={()=>zoomBy(1.5)} style={Z.btn}><Text style={Z.btnText}>+</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Ajustar à tela" onPress={()=>apply({s:1,x:0,y:0})} style={Z.btn}><Text style={[Z.btnText,{fontSize:12,letterSpacing:.8}]}>AJUSTAR</Text></Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Fechar imagem ampliada" onPress={onClose} style={[Z.btn,{borderColor:'#fff'}]}><Text style={Z.btnText}>✕</Text></Pressable>
   </View>
   <Text style={Z.hint}>Pinça ou toque duplo para ampliar · arraste para mover</Text>
  </View>
 </Modal>;
}
const Z=StyleSheet.create({
 root:{flex:1,backgroundColor:'#0a0f20f7',paddingTop:36,paddingBottom:12},
 stage:{flex:1,alignItems:'center',justifyContent:'center',overflow:'hidden',paddingHorizontal:8},
 img:{width:'100%',height:'100%'},
 bar:{flexDirection:'row',gap:10,alignItems:'center',justifyContent:'center',paddingTop:10,flexWrap:'wrap'},
 btn:{minWidth:48,height:48,borderRadius:14,borderWidth:2,borderColor:'#4a5580',backgroundColor:'#1d2748',alignItems:'center',justifyContent:'center',paddingHorizontal:14},
 btnText:{color:'#fff',fontWeight:'900',fontSize:20},
 pct:{minWidth:64,textAlign:'center',color:'#ffd369',fontWeight:'900',fontSize:22},
 hint:{textAlign:'center',color:'#b9c3da',fontSize:11,paddingTop:8},
});
