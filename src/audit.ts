import { Client } from '@elastic/elasticsearch'
import logger from "./logger"

class Audit {
    private client: Client | null = null

    public getClient() {
        if (!this.client) {
            this.client = new Client({
                node: process.env.AUDIT_URL
            })
        }
        return this.client
    }    

    public auditEnabled(): boolean {
        return !! process.env.AUDIT_URL 
    }

    public async auditItem(change: ChangeType, id: number, identifier: string, item: AuditItem, login: string, changedAt: Date) {
        if (!this.auditEnabled()) return
        const body = {
            itemId: id,
            identifier: identifier,
            operation: change,
            user: login,
            changedAt: changedAt,
            data: item
        }
        try {
            await this.getClient().index({
                index: "items",
                body: body
            })
        } catch (err:any) {
            logger.error(err)
            logger.error("Error sending audit for item: " + err.meta.body.error.reason+", body: "+JSON.stringify(body))
        }
    }

    public async auditItemRelation(change: ChangeType, id: number, identifier: string, item: AuditItemRelation, login: string, changedAt: Date) {
        if (!this.auditEnabled()) return
            const body = {
                itemRelationId: id,
                identifier: identifier,
                operation: change,
                user: login,
                changedAt: changedAt,
                data: item
            }
            try {
            await this.getClient().index({
                index: "item_relations",
                body: body
            })
        } catch (err:any) {
            logger.error(err)
            logger.error("Error sending audit for item relation" + err.meta.body.error.reason+", body: "+JSON.stringify(body))
        }
    }

    public async getItemHistory(id: number, offset: number, limit: number, order: any) {
        if (!this.auditEnabled()) return {count: 0, rows: []}
        try {
            const sort = order ? order.map((elem:any) => { const data:any = {}; data[elem[0]] = elem[1]; return data; } ) : null
            const response:any = await this.getClient().search({
                index: "items",
                from: offset,
                size: limit,
                body: {
                    query: {
                    term: {
                        itemId: id
                    }
                    },
                    sort: sort
                }
            })
            return { count: response.hits.total.value, rows: response.hits.hits.map((elem:any) => { elem._source.id = elem._id; return elem._source })}
        } catch (err) {
            logger.error("Error getting audit for item", err)
            return { count: 0, rows: []}
        }
    }

    public async getItemRelationHistory(id: number, offset: number, limit: number, order: any) {
        if (!this.auditEnabled()) return {count: 0, rows: []}
            try {
                const sort = order ? order.map((elem:any) => { const data:any = {}; data[elem[0]] = elem[1]; return data; } ) : null
                const response:any = await this.getClient().search({
                    index: "item_relations",
                    from: offset,
                    size: limit,
                    body: {
                        query: {
                        term: {
                            itemRelationId: id
                        }
                        },
                        sort: sort
                    }
                })
            return { count: response.hits.total.value, rows: response.hits.hits.map((elem:any) => { elem._source.id = elem._id; return elem._source })}
            } catch (err) {
                logger.error("Error getting audit for item relation", err)
                return { count: 0, rows: []}
            }
        }
   
}

export enum ChangeType {
    CREATE = 1,
    UPDATE,
    DELETE
}

export interface AuditItem {
    added?: ItemChanges,
    changed?: ItemChanges,
    old?: ItemChanges,
    deleted?: ItemChanges
}

export interface ItemChanges {
    typeIdentifier?: string
    parentIdentifier?: string
    name?: any
    values?: any
    fileOrigName?: string
    mimeType?: string
}

export interface AuditItemRelation {
    added?: ItemRelationChanges,
    changed?: ItemRelationChanges,
    old?: ItemRelationChanges,
    deleted?: ItemRelationChanges
}

export interface ItemRelationChanges {
    relationIdentifier?: string
    itemIdentifier?: string
    targetIdentifier?: string
    values?: any
}  

const audit = new Audit()
export default audit