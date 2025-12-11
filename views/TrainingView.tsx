
import React, { useState } from 'react';
import { SchemaField, TrainingRules, ExtractionRule } from '../types';
import { ICONS } from '../constants';

interface TrainingViewProps {
  rules: TrainingRules;
  onSave: (newRules: TrainingRules) => void;
}

const TrainingView: React.FC<TrainingViewProps> = ({ rules, onSave }) => {
  const [schema, setSchema] = useState<SchemaField[]>(rules.schema);
  const [naturalLanguageRules, setNaturalLanguageRules] = useState(rules.naturalLanguageRules);
  const [conditionalRules, setConditionalRules] = useState<ExtractionRule[]>(rules.conditionalRules || []);

  // New Rule State
  const [newRule, setNewRule] = useState<Partial<ExtractionRule>>({
      condition: { field: 'FILENAME', operator: 'contains', value: '' },
      instruction: '',
      name: ''
  });

  const handleAddField = () => {
    setSchema([...schema, { id: Date.now().toString(), name: '', type: 'string', description: '' }]);
  };

  const handleRemoveField = (id: string) => {
    setSchema(schema.filter(field => field.id !== id));
  };

  const handleFieldChange = (id: string, event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setSchema(schema.map(field => field.id === id ? { ...field, [name]: value } : field));
  };

  const handleAddRule = () => {
      if (!newRule.name || !newRule.instruction || !newRule.condition?.value) {
          alert("Please fill in all rule fields.");
          return;
      }
      
      const rule: ExtractionRule = {
          id: Date.now().toString(),
          name: newRule.name,
          active: true,
          condition: newRule.condition as any,
          instruction: newRule.instruction,
          targetField: newRule.targetField
      };

      setConditionalRules([...conditionalRules, rule]);
      setNewRule({
        condition: { field: 'FILENAME', operator: 'contains', value: '' },
        instruction: '',
        name: '',
        targetField: ''
      });
  };

  const handleRemoveRule = (id: string) => {
      setConditionalRules(conditionalRules.filter(r => r.id !== id));
  };

  const handleToggleRule = (id: string) => {
      setConditionalRules(conditionalRules.map(r => r.id === id ? { ...r, active: !r.active } : r));
  };

  const handleSave = () => {
    onSave({ schema, naturalLanguageRules, conditionalRules });
    alert('Training rules saved successfully!');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto bg-slate-50 dark:bg-slate-900 min-h-full">
      <div className="mb-8 flex justify-between items-end">
        <div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white">AI Training Center</h2>
            <p className="text-slate-500 mt-1">Configure parsing logic, data schema, and conditional extraction rules.</p>
        </div>
        <button onClick={handleSave} className="bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 px-6 rounded shadow-lg transition-all">
          Save Configuration
        </button>
      </div>

      {/* Visual Flow Representation */}
      <div className="mb-8 bg-white dark:bg-slate-800 p-6 rounded shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Parsing Logic Flow</h3>
          <div className="flex items-center justify-between relative">
              {/* Line */}
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-700 -z-0"></div>

              <div className="z-10 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-4 py-3 text-center w-40">
                  <div className="text-blue-600 mb-1">{ICONS.document}</div>
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">Document</div>
              </div>

              <div className="z-10 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded px-4 py-3 text-center w-40">
                  <div className="text-blue-600 mb-1 font-mono text-xs">Schema</div>
                  <div className="text-xs font-bold text-blue-800 dark:text-blue-200">Base Extraction</div>
              </div>

              <div className="z-10 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded px-4 py-3 text-center w-40">
                  <div className="text-amber-600 mb-1 font-mono text-xs">If / Then</div>
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-200">Conditional Rules</div>
              </div>

              <div className="z-10 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded px-4 py-3 text-center w-40">
                  <div className="text-green-600 mb-1">✔</div>
                  <div className="text-xs font-bold text-green-800 dark:text-green-200">Final Output</div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Col: Schema & Global Rules */}
        <div className="lg:col-span-7 space-y-8">
             {/* Schema */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded shadow border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">1. Data Schema</h3>
                <div className="space-y-3 mb-4">
                {schema.map((field) => (
                    <div key={field.id} className="grid grid-cols-12 gap-2 items-center p-2 bg-slate-50 dark:bg-slate-700/50 rounded border border-slate-200 dark:border-slate-600">
                    <div className="col-span-4">
                        <input type="text" name="name" value={field.name} onChange={(e) => handleFieldChange(field.id, e)} className="w-full text-xs font-mono p-1 bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none dark:text-white" placeholder="field_name"/>
                    </div>
                    <div className="col-span-3">
                        <select name="type" value={field.type} onChange={(e) => handleFieldChange(field.id, e)} className="w-full text-xs p-1 bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none dark:text-slate-300">
                            <option value="string">String</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                        </select>
                    </div>
                    <div className="col-span-4">
                        <input type="text" name="description" value={field.description} onChange={(e) => handleFieldChange(field.id, e)} className="w-full text-xs p-1 bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none dark:text-slate-300" placeholder="Description..."/>
                    </div>
                    <div className="col-span-1 flex justify-end">
                        <button onClick={() => handleRemoveField(field.id)} className="text-slate-400 hover:text-red-600">{ICONS.trash}</button>
                    </div>
                    </div>
                ))}
                </div>
                <button onClick={handleAddField} className="text-xs font-bold text-blue-700 hover:text-blue-900 uppercase tracking-wide flex items-center gap-1">
                    {ICONS.plus} Add Field
                </button>
            </div>

             {/* Global Rules */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded shadow border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">2. Global Extraction Hints</h3>
                <p className="text-xs text-slate-500 mb-3">General instructions applied to ALL documents (e.g., "PO Number is typically at the top right").</p>
                <textarea
                value={naturalLanguageRules}
                onChange={(e) => setNaturalLanguageRules(e.target.value)}
                rows={4}
                className="w-full p-3 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-none dark:bg-slate-600 dark:border-slate-500 leading-relaxed"
                />
            </div>
        </div>
        
        {/* Right Col: Conditional Rules */}
        <div className="lg:col-span-5">
            <div className="bg-white dark:bg-slate-800 p-6 rounded shadow border border-slate-200 dark:border-slate-700 h-full flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">3. Conditional Logic</h3>
                <p className="text-xs text-slate-500 mb-6">
                    Define rules that apply only when specific criteria are met. This triggers a multi-step refinement process.
                </p>

                {/* Rule Builder */}
                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded border border-slate-200 dark:border-slate-700 mb-6">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-3">New Rule</h4>
                    
                    <div className="space-y-3">
                        <input 
                            type="text" 
                            placeholder="Rule Name (e.g. Acme Logic)" 
                            value={newRule.name}
                            onChange={e => setNewRule({...newRule, name: e.target.value})}
                            className="w-full text-sm p-2 border border-slate-300 dark:border-slate-600 rounded"
                        />
                        
                        <div className="flex gap-2 items-center bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                            <span className="text-xs font-bold text-slate-500">IF</span>
                            <select 
                                className="text-xs p-1 border rounded max-w-[120px]"
                                value={newRule.condition?.field}
                                onChange={e => setNewRule({...newRule, condition: { ...newRule.condition!, field: e.target.value }})}
                            >
                                <option value="FILENAME">Filename</option>
                                <option disabled>--- Header Fields ---</option>
                                {schema.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                                <option disabled>--- Line Items ---</option>
                                <option value="VendorItemNumber">Item # (VendorItemNumber)</option>
                                <option value="ItemDescription">Description (ItemDescription)</option>
                                <option value="QuantityOrdered">Quantity (QuantityOrdered)</option>
                                <option value="CostEach">Unit Cost (CostEach)</option>
                                <option value="CostExtended">Total Cost (CostExtended)</option>
                            </select>
                            <select 
                                className="text-xs p-1 border rounded"
                                value={newRule.condition?.operator}
                                onChange={e => setNewRule({...newRule, condition: { ...newRule.condition!, operator: e.target.value as any }})}
                            >
                                <option value="contains">Contains</option>
                                <option value="equals">Equals</option>
                                <option value="starts_with">Starts With</option>
                            </select>
                        </div>
                        <input 
                            type="text" 
                            placeholder="Value (e.g. Acme, Invoice_A, or 12345)"
                            value={newRule.condition?.value}
                            onChange={e => setNewRule({...newRule, condition: { ...newRule.condition!, value: e.target.value }})}
                            className="w-full text-sm p-2 border border-slate-300 dark:border-slate-600 rounded"
                        />

                        <div className="pt-2">
                             <span className="text-xs font-bold text-slate-500 block mb-1">THEN (Instruction to AI)</span>
                             <textarea 
                                placeholder="e.g. Append ' - CONFIRMED' to description."
                                value={newRule.instruction}
                                onChange={e => setNewRule({...newRule, instruction: e.target.value})}
                                rows={2}
                                className="w-full text-sm p-2 border border-slate-300 dark:border-slate-600 rounded"
                             />
                        </div>

                        <div className="flex justify-between items-center">
                            <select 
                                className="text-xs p-1 border rounded text-slate-500"
                                value={newRule.targetField || ''}
                                onChange={e => setNewRule({...newRule, targetField: e.target.value})}
                            >
                                <option value="">(Optional) Link to Field</option>
                                {schema.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                            </select>
                            <button onClick={handleAddRule} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded font-bold hover:bg-blue-700">
                                Add Rule
                            </button>
                        </div>
                    </div>
                </div>

                {/* Active Rules List */}
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar max-h-[400px]">
                    {conditionalRules.length === 0 && <p className="text-center text-xs text-slate-400 italic py-4">No conditional rules defined.</p>}
                    
                    {conditionalRules.map(rule => (
                        <div key={rule.id} className={`p-3 rounded border text-sm relative group ${rule.active ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800' : 'bg-slate-100 border-slate-200 opacity-60'}`}>
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-slate-800 dark:text-slate-200">{rule.name}</span>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="checkbox" 
                                        checked={rule.active} 
                                        onChange={() => handleToggleRule(rule.id)}
                                        className="cursor-pointer"
                                        title="Toggle Active"
                                    />
                                    <button onClick={() => handleRemoveRule(rule.id)} className="text-slate-400 hover:text-red-500">{ICONS.trash}</button>
                                </div>
                            </div>
                            <div className="text-xs font-mono text-slate-600 dark:text-slate-400 mb-1">
                                IF {rule.condition.field} {rule.condition.operator} "{rule.condition.value}"
                            </div>
                            <div className="text-xs text-slate-700 dark:text-slate-300 italic pl-2 border-l-2 border-amber-300">
                                "{rule.instruction}"
                            </div>
                            {rule.targetField && (
                                <div className="mt-1 text-[10px] text-blue-600 uppercase font-bold">Target: {rule.targetField}</div>
                            )}
                        </div>
                    ))}
                </div>

            </div>
        </div>

      </div>
    </div>
  );
};

export default TrainingView;